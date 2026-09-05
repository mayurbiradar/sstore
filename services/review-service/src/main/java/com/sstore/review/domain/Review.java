package com.sstore.review.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Review {

    public enum Status { PENDING, APPROVED, REJECTED }

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    /**
     * Display name captured from Keycloak claims at submission time.
     * Nullable: existing rows pre-V2 have no name; old reviews fall back
     * to a generic "Customer" label until the author posts again.
     */
    @Column(name = "reviewer_first_name")
    private String reviewerFirstName;

    @Column(name = "reviewer_last_name")
    private String reviewerLastName;

    /** The order that authorised this review (null when require-purchase=false). */
    @Column(name = "order_id")
    private UUID orderId;

    @Column(nullable = false)
    private Short rating;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "verified_purchase", nullable = false)
    @Builder.Default
    private boolean verifiedPurchase = false;

    @Column(name = "helpful_count", nullable = false)
    @Builder.Default
    private Integer helpfulCount = 0;

    @Column(name = "unhelpful_count", nullable = false)
    @Builder.Default
    private Integer unhelpfulCount = 0;

    @Column(name = "rejection_reason", columnDefinition = "text")
    private String rejectionReason;

    @Column(name = "moderated_by")
    private String moderatedBy;

    @Column(name = "moderated_at")
    private Instant moderatedAt;

    @Column(name = "edit_count", nullable = false)
    @Builder.Default
    private Integer editCount = 0;

    @Column(name = "last_edited_at")
    private Instant lastEditedAt;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Version
    private Long version;
}
