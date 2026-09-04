package com.sstore.product.repository;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sstore.product.domain.Product;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    /**
     * Atomic aggregate update: set avg_rating and review_count in one round-trip
     * using a SQL upsert. The caller passes the precomputed new values
     * (computed in review-service on its own side and re-broadcast here for
     * idempotency, or recomputed locally with `recompute`).
     */
    @Modifying
    @Query("""
        UPDATE Product p
           SET p.avgRating   = :avgRating,
               p.reviewCount = :reviewCount
         WHERE p.id = :productId
        """)
    int updateReviewAggregate(@Param("productId") UUID productId,
                              @Param("avgRating") BigDecimal avgRating,
                              @Param("reviewCount") int reviewCount);

    @Modifying
    @Query("""
        UPDATE Product p
           SET p.soldCount = p.soldCount + :delta
         WHERE p.id = :productId
        """)
    int incrementSoldCount(@Param("productId") UUID productId,
                           @Param("delta") int delta);
}
