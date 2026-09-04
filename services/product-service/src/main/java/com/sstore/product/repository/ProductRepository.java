package com.sstore.product.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sstore.product.domain.Product;

public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    /** Storefront-facing flat list: only visible rows.
     *  Admin endpoints that need to see inactive/draft rows use {@code findAll()}. */
    @Query("""
        SELECT p FROM Product p
         WHERE p.active = true
           AND p.deletedAt IS NULL
         ORDER BY p.updatedAt DESC
        """)
    List<Product> findAllVisible();

    /** Storefront-facing featured-only list: visible AND featured.
     *  Used by the Home page "Trending now" tile. */
    @Query("""
        SELECT p FROM Product p
         WHERE p.active = true
           AND p.deletedAt IS NULL
           AND p.featured = true
         ORDER BY p.updatedAt DESC
        """)
    List<Product> findAllVisibleFeatured();

    /**
     * Admin-only list: every non-deleted row, including inactive drafts so the
     * admin can flip them active. Soft-deleted rows are excluded (admin should
     * not see them; they're gone from the catalog).
     */
    @Query("""
        SELECT p FROM Product p
         WHERE p.deletedAt IS NULL
         ORDER BY p.updatedAt DESC
        """)
    List<Product> findAllNotDeleted();

    /**
     * Atomic aggregate update: set avg_rating and review_count in one round-trip.
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

    // -------------------------------------------------------------------------
    // Admin-side analytics queries.
    // -------------------------------------------------------------------------

    /** Products whose on-hand stock has fallen at or below the fixed threshold (5). */
    @Query("""
        SELECT p FROM Product p
         WHERE p.active = true
           AND p.deletedAt IS NULL
           AND p.stock <= 5
         ORDER BY p.stock ASC, p.name ASC
        """)
    List<Product> findLowStock();

    /** Count of products grouped by active/inactive flag. */
    @Query("""
        SELECT p.active, COUNT(p)
          FROM Product p
         WHERE p.deletedAt IS NULL
         GROUP BY p.active
        """)
    List<Object[]> countByActive();

    /** Top-selling products by `sold_count`. */
    @Query("""
        SELECT p FROM Product p
         WHERE p.deletedAt IS NULL
           AND p.soldCount > 0
         ORDER BY p.soldCount DESC, p.name ASC
        """)
    List<Product> findTopSelling(org.springframework.data.domain.Pageable pageable);

    /** Recently updated products. */
    @Query("""
        SELECT p FROM Product p
         WHERE p.deletedAt IS NULL
           AND p.updatedAt >= :since
         ORDER BY p.updatedAt DESC
        """)
    List<Product> findRecentlyUpdated(@Param("since") Instant since,
                                      org.springframework.data.domain.Pageable pageable);

    /** Bulk stock adjustment: set stock to a given value. */
    @Modifying
    @Query("""
        UPDATE Product p
           SET p.stock     = :stock,
               p.updatedAt = :now
         WHERE p.id = :productId
           AND p.deletedAt IS NULL
        """)
    int setStock(@Param("productId") UUID productId,
                 @Param("stock") int stock,
                 @Param("now") Instant now);

    /** Bulk stock adjustment: increment stock by a delta (can be negative). */
    @Modifying
    @Query("""
        UPDATE Product p
           SET p.stock     = p.stock + :delta,
               p.updatedAt = :now
         WHERE p.id = :productId
           AND p.deletedAt IS NULL
        """)
    int adjustStock(@Param("productId") UUID productId,
                    @Param("delta") int delta,
                    @Param("now") Instant now);
}