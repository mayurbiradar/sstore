package com.sstore.review.kafka;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Minimal projection of an OrderDelivered event we care about. */
public record OrderDeliveredEvent(
    String eventType,
    UUID orderId,
    String userId,
    List<Item> items,
    Instant occurredAt
) {
    public record Item(UUID productId, String sku, Integer quantity) {}
}
