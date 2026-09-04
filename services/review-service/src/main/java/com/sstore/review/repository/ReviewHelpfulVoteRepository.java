package com.sstore.review.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sstore.review.domain.ReviewHelpfulVote;

public interface ReviewHelpfulVoteRepository extends JpaRepository<ReviewHelpfulVote, UUID> {
    Optional<ReviewHelpfulVote> findByReviewIdAndUserId(UUID reviewId, String userId);
}
