package com.sstore.inventory.kafka;

import java.time.Instant;
import java.util.UUID;

/** Mirrors contracts/events/payments.json. */
public record PaymentEvent(
        String eventType,
        UUID paymentId,
        UUID orderId,
        String provider,
        String providerPaymentId,
        Long amount,
        String currency,
        String reason,
        Instant occurredAt
) {}
