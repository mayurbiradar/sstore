package com.sstore.product.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Idempotency record for inventory-driven stock adjustments on Product.
 * One row per reservationId; the PK guarantees at-most-once application
 * of each Reserved/Released/Expired transition even on Kafka redelivery.
 */
@Entity
@Table(name = "processed_stock_events")
@Getter
@Setter
@NoArgsConstructor
public class ProcessedStockEvent {

    @Id
    @Column(name = "reservation_id")
    private UUID reservationId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt = Instant.now();
}