package com.sstore.product.kafka;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Default type hint used by Spring's JsonDeserializer when the producer
 * doesn't set type headers. Only the fields relevant to product-service
 * are kept; everything else is dropped.
 */
public record ReviewApprovedEvent(
    String eventType,
    String productId,
    BigDecimal avgRating,
    int reviewCount,
    Instant occurredAt
) {}
