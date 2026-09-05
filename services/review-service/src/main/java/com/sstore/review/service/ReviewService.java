package com.sstore.review.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sstore.review.config.ReviewProperties;
import com.sstore.review.domain.Review;
import com.sstore.review.domain.Review.Status;
import com.sstore.review.domain.ReviewHelpfulVote;
import com.sstore.review.kafka.ReviewEventPublisher;
import com.sstore.review.repository.PurchaseProofRepository;
import com.sstore.review.repository.ReviewHelpfulVoteRepository;
import com.sstore.review.repository.ReviewRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * The review bounded context. Every public method enforces the validation
 * rules from {@link ReviewProperties}; configuration is read at request time
 * so operators can change policy without redeploying.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewHelpfulVoteRepository voteRepository;
    private final PurchaseProofRepository purchaseProofRepository;
    private final ReviewEventPublisher eventPublisher;
    private final ReviewProperties props;

    // ---------------------------------------------------------------------
    // Submission
    // ---------------------------------------------------------------------

    @Transactional
    public Review submit(SubmitCommand cmd) {
        validateNew(cmd);

        boolean verified = false;
        UUID orderId = cmd.orderId();
        if (props.requirePurchase()) {
            verified = verifyPurchase(cmd.userId(), cmd.productId());
            if (!verified) {
                throw new IllegalStateException(
                    "User " + cmd.userId() + " has no delivered order containing product " + cmd.productId());
            }
            if (orderId == null) {
                // Pick the most recent delivered order as the proof.
                orderId = purchaseProofRepository.findByUserIdAndProductId(cmd.userId(), cmd.productId())
                    .stream()
                    .findFirst()
                    .map(p -> p.getOrderId())
                    .orElseThrow(() -> new IllegalStateException("verified but orderId missing"));
            }
        }

        Status initial = decideInitialStatus();

        Review review = Review.builder()
            .productId(cmd.productId())
            .userId(cmd.userId())
            .orderId(orderId)
            .rating(cmd.rating().shortValue())
            .title(cmd.title().trim())
            .body(cmd.body().trim())
            .reviewerFirstName(emptyToNull(cmd.reviewerFirstName()))
            .reviewerLastName(emptyToNull(cmd.reviewerLastName()))
            .status(initial)
            .verifiedPurchase(verified)
            .build();
        Review saved = reviewRepository.save(review);

        publishEvent("ReviewSubmitted", saved);
        if (initial == Status.APPROVED) {
            publishAggregateUpdate(saved.getProductId(), "ReviewApproved");
        }
        return saved;
    }

    private Status decideInitialStatus() {
        return switch (props.moderation().policy()) {
            case AUTO_APPROVE -> Status.APPROVED;
            case ALWAYS_PENDING -> Status.PENDING;
            case ALWAYS_APPROVE -> Status.APPROVED;
        };
    }

    private void validateNew(SubmitCommand cmd) {
        if (cmd.rating() < props.rating().min() || cmd.rating() > props.rating().max()) {
            throw new IllegalArgumentException("rating must be between " + props.rating().min()
                + " and " + props.rating().max());
        }
        int titleLen = cmd.title() == null ? 0 : cmd.title().trim().length();
        if (titleLen < props.title().minLength() || titleLen > props.title().maxLength()) {
            throw new IllegalArgumentException("title length must be between "
                + props.title().minLength() + " and " + props.title().maxLength());
        }
        int bodyLen = cmd.body() == null ? 0 : cmd.body().trim().length();
        if (bodyLen < props.body().minLength() || bodyLen > props.body().maxLength()) {
            throw new IllegalArgumentException("body length must be between "
                + props.body().minLength() + " and " + props.body().maxLength());
        }
    }

    private boolean verifyPurchase(String userId, UUID productId) {
        return purchaseProofRepository.existsByUserIdAndProductId(userId, productId);
    }

    // ---------------------------------------------------------------------
    // Moderation
    // ---------------------------------------------------------------------

    @Transactional
    public Review approve(UUID reviewId, String adminSub) {
        Review r = mustFind(reviewId);
        if (r.getStatus() == Status.APPROVED) return r;
        r.setStatus(Status.APPROVED);
        r.setModeratedBy(adminSub);
        r.setModeratedAt(Instant.now());
        r.setRejectionReason(null);
        Review saved = reviewRepository.save(r);
        publishAggregateUpdate(saved.getProductId(), "ReviewApproved");
        return saved;
    }

    @Transactional
    public Review reject(UUID reviewId, String adminSub, String reason) {
        Review r = mustFind(reviewId);
        if (r.getStatus() == Status.REJECTED) return r;
        boolean wasApproved = r.getStatus() == Status.APPROVED;
        r.setStatus(Status.REJECTED);
        r.setModeratedBy(adminSub);
        r.setModeratedAt(Instant.now());
        r.setRejectionReason(reason);
        Review saved = reviewRepository.save(r);
        if (wasApproved) {
            publishAggregateUpdate(saved.getProductId(), "ReviewDeleted");
        }
        return saved;
    }

    @Transactional
    public void delete(UUID reviewId, String actorSub) {
        Review r = mustFind(reviewId);
        boolean wasApproved = r.getStatus() == Status.APPROVED;
        UUID productId = r.getProductId();
        reviewRepository.delete(r);
        if (wasApproved) {
            publishAggregateUpdate(productId, "ReviewDeleted");
        }
    }

    // ---------------------------------------------------------------------
    // Edits (within edit window)
    // ---------------------------------------------------------------------

    @Transactional
    public Review edit(UUID reviewId, String userSub, SubmitCommand cmd) {
        Review r = mustFind(reviewId);
        if (!r.getUserId().equals(userSub)) {
            throw new SecurityException("not your review");
        }
        if (Instant.now().isAfter(r.getCreatedAt().plus(props.editWindowDays(), ChronoUnit.DAYS))) {
            throw new IllegalStateException("edit window of " + props.editWindowDays() + " days has passed");
        }
        validateNew(cmd);
        boolean wasApproved = r.getStatus() == Status.APPROVED;
        r.setRating(cmd.rating().shortValue());
        // Keep names fresh in case the user updated their profile since the
        // original submit; the authoritative source is always the current JWT.
        r.setReviewerFirstName(emptyToNull(cmd.reviewerFirstName()));
        r.setReviewerLastName(emptyToNull(cmd.reviewerLastName()));
        r.setTitle(cmd.title().trim());
        r.setBody(cmd.body().trim());
        r.setEditCount(r.getEditCount() + 1);
        r.setLastEditedAt(Instant.now());
        Review saved = reviewRepository.save(r);
        if (wasApproved) {
            publishAggregateUpdate(saved.getProductId(), "ReviewApproved");
        }
        return saved;
    }

    // ---------------------------------------------------------------------
    // Helpful votes
    // ---------------------------------------------------------------------

    @Transactional
    public Review vote(UUID reviewId, String userSub, boolean helpful) {
        if (!props.helpfulVote().enabled()) {
            throw new IllegalStateException("helpful votes are disabled");
        }
        if (props.helpfulVote().requireLogin() && (userSub == null || userSub.isBlank())) {
            throw new SecurityException("login required to vote");
        }
        Review r = mustFind(reviewId);
        if (r.getStatus() != Status.APPROVED) {
            throw new IllegalStateException("can only vote on approved reviews");
        }

        var existing = voteRepository.findByReviewIdAndUserId(reviewId, userSub);
        if (existing.isPresent()) {
            ReviewHelpfulVote v = existing.get();
            if (v.isHelpful() == helpful) {
                // toggling off -> remove the vote
                voteRepository.delete(v);
                if (helpful) r.setHelpfulCount(Math.max(0, r.getHelpfulCount() - 1));
                else         r.setUnhelpfulCount(Math.max(0, r.getUnhelpfulCount() - 1));
            } else {
                // switched polarity -> adjust both counters
                v.setHelpful(helpful);
                if (helpful) {
                    r.setHelpfulCount(r.getHelpfulCount() + 1);
                    r.setUnhelpfulCount(Math.max(0, r.getUnhelpfulCount() - 1));
                } else {
                    r.setUnhelpfulCount(r.getUnhelpfulCount() + 1);
                    r.setHelpfulCount(Math.max(0, r.getHelpfulCount() - 1));
                }
            }
        } else {
            voteRepository.save(ReviewHelpfulVote.builder()
                .reviewId(reviewId)
                .userId(userSub)
                .helpful(helpful)
                .build());
            if (helpful) r.setHelpfulCount(r.getHelpfulCount() + 1);
            else         r.setUnhelpfulCount(r.getUnhelpfulCount() + 1);
        }
        return reviewRepository.save(r);
    }

    // ---------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<Review> listForProduct(UUID productId, Pageable pageable) {
        return reviewRepository.findByProductIdAndStatus(productId, Status.APPROVED, pageable);
    }

    @Transactional(readOnly = true)
    public Page<Review> listForUser(String userId, Pageable pageable) {
        return reviewRepository.findByUserId(userId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<Review> moderationQueue(Pageable pageable) {
        return reviewRepository.findByStatus(Status.PENDING, pageable);
    }

    @Transactional(readOnly = true)
    public Review get(UUID reviewId) {
        return mustFind(reviewId);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    private Review mustFind(UUID id) {
        return reviewRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("review " + id + " not found"));
    }

    private void publishEvent(String type, Review r) {
        Map<String, Object> payload = Map.of(
            "eventType", type,
            "reviewId", r.getId().toString(),
            "productId", r.getProductId().toString(),
            "userId", r.getUserId(),
            "rating", r.getRating(),
            "title", r.getTitle(),
            "status", r.getStatus().name(),
            "verifiedPurchase", r.isVerifiedPurchase(),
            "occurredAt", Instant.now().toString()
        );
        eventPublisher.enqueue("reviews", r.getProductId().toString(), type, payload);
    }

    /**
     * Recompute (avg_rating, review_count) for a product and publish a single
     * aggregate event. Product-service is idempotent on the (avg, count) pair
     * so duplicate publishes are safe.
     */
    private void publishAggregateUpdate(UUID productId, String eventType) {
        List<Object[]> rows = reviewRepository.recomputeAggregate(productId);
        BigDecimal avg;
        Long count;
        if (rows.isEmpty() || rows.get(0) == null) {
            avg = BigDecimal.ZERO;
            count = 0L;
        } else {
            Object[] agg = rows.get(0);
            // Hibernate 7 maps AVG(int) to Double, AVG(BigDecimal) to BigDecimal.
            // Be tolerant of either so the read-side doesn't break the write-side.
            Object avgRaw = agg[0];
            if (avgRaw instanceof BigDecimal bd) {
                avg = bd;
            } else if (avgRaw instanceof Number n) {
                avg = BigDecimal.valueOf(n.doubleValue());
            } else {
                avg = BigDecimal.ZERO;
            }
            Object countRaw = agg[1];
            count = (countRaw instanceof Number n) ? n.longValue() : 0L;
        }
        if (avg == null) avg = BigDecimal.ZERO;
        BigDecimal avgRounded = avg.setScale(2, RoundingMode.HALF_UP);

        Map<String, Object> payload = Map.of(
            "eventType", eventType,
            "productId", productId.toString(),
            "avgRating", avgRounded.toPlainString(),
            "reviewCount", count.intValue(),
            "occurredAt", Instant.now().toString()
        );
        eventPublisher.enqueue("reviews", productId.toString(), eventType, payload);
    }

    /** Command object so the controller stays thin. */
    private static String emptyToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Command object so the controller stays thin. */
    public record SubmitCommand(
        UUID productId,
        String userId,
        UUID orderId,
        Integer rating,
        String title,
        String body,
        /** First/last name captured from the user's JWT at submit time. */
        String reviewerFirstName,
        String reviewerLastName
    ) {}
}
