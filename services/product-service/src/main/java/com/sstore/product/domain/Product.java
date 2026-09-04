package com.sstore.product.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Data;

/**
 * Product aggregate root.
 *
 * Money is stored as bigint in the smallest currency unit (paise/cents).
 *
 * Catalog visibility is governed solely by {@code active} + {@code deletedAt}.
 * There's no draft lifecycle — admin fills in price/description/stock on the
 * edit page before flipping {@code active} to true.
 */
@Entity
@Table(name = "products")
@Data
public class Product {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String sku;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private Long price; // paise

    @Column(nullable = false)
    private String currency = "INR";

    @Column(nullable = false)
    private boolean taxable = true;

    /** Primary image URL — relative ("/images/xxx.jpg"). */
    private String image;

    /** Denormalized average rating, kept up-to-date by review-service via Kafka. */
    @Column(name = "avg_rating", nullable = false, precision = 3, scale = 2)
    private BigDecimal avgRating = BigDecimal.ZERO;

    /** Count of approved reviews. */
    @Column(name = "review_count", nullable = false)
    private Integer reviewCount = 0;

    /** Count of units sold (sum of delivered order line quantities). */
    @Column(name = "sold_count", nullable = false)
    private Integer soldCount = 0;

    @Column(nullable = false)
    private Integer stock = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private boolean featured = false;

    @Version
    private Long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt; // soft delete

    @Column(name = "published_at")
    private Instant publishedAt;
}
