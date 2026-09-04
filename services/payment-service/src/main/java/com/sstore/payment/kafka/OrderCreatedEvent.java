package com.sstore.payment.kafka;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Mirrors contracts/events/orders.json (OrderCreated). Defined as a Java record
 * so we can deserialize straight off the orders topic. We don't share a JAR
 * between services — the JSON contract is the integration.
 */
public record OrderCreatedEvent(
        String eventType,
        UUID orderId,
        String userId,
        Long totalAmount,
        String currency,
        String paymentMethod,
        List<Item> items,
        Instant createdAt
) {
    public record Item(String sku, UUID productId, String productName, Integer quantity) {}
}
