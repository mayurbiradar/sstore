package com.sstore.inventory.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Immutable record of every on_hand/reserved change.
 * Reasons: TOPUP | RESERVE | COMMIT | RELEASE | EXPIRE | ADJUST
 */
@Entity
@Table(name = "stock_movements")
@Getter
@Setter
public class StockMovement {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(nullable = false)
    private String sku;

    @Column(name = "delta_on_hand", nullable = false)
    private Integer deltaOnHand = 0;

    @Column(name = "delta_reserved", nullable = false)
    private Integer deltaReserved = 0;

    @Column(nullable = false)
    private String reason;

    /** ORDER | RESERVATION | MANUAL */
    @Column(name = "reference_type")
    private String referenceType;

    /** order_id, reservation_id, etc. */
    @Column(name = "reference_id")
    private String referenceId;

    /** user sub or "system" */
    @Column(nullable = false)
    private String actor;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
