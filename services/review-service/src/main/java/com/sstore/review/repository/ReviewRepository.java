package com.sstore.review.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sstore.review.domain.Review;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    Page<Review> findByProductIdAndStatus(UUID productId, Review.Status status, Pageable pageable);

    Page<Review> findByStatus(Review.Status status, Pageable pageable);

    Page<Review> findByUserId(String userId, Pageable pageable);

    Optional<Review> findByProductIdAndUserIdAndOrderId(UUID productId, String userId, UUID orderId);

    List<Review> findByProductIdAndStatus(UUID productId, Review.Status status);

    /**
     * Aggregate recomputation: average and count of approved reviews for a
     * product. Returned as Object[] of [BigDecimal avg, Long count]. Returns
     * [BigDecimal.ZERO, 0L] when no approved reviews exist (handled in repo
     * via COALESCE).
     */
    @Query("""
        SELECT COALESCE(AVG(r.rating), 0), COUNT(r.id)
          FROM Review r
         WHERE r.productId = :productId
           AND r.status = com.sstore.review.domain.Review.Status.APPROVED
        """)
    List<Object[]> recomputeAggregate(@Param("productId") UUID productId);
}
