package com.sstore.order.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Maps an Idempotency-Key header value to the order it produced.
 * A unique-key violation on insert is how we detect a duplicate POST.
 */
@Entity
@Table(name = "order_idempotency_keys")
@Getter
@Setter
public class OrderIdempotencyKey {

    @Id
    private String key;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
