package com.sstore.review.kafka;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sstore.review.domain.PurchaseProof;
import com.sstore.review.repository.PurchaseProofRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Listens to the `orders` topic. For every {@code OrderDelivered} event we
 * cache a {@link PurchaseProof} row so the review API can verify "did this
 * user actually buy this product?" without a synchronous call to
 * order-service.
 *
 * <p>The {@code orders} topic is shared with multiple other event types
 * ({@code InventoryReserved}, {@code OrderCreated}, {@code OrderConfirmed},
 * {@code OrderPacked}, {@code OrderShipped}, …) that have different field
 * shapes. We therefore bind the payload as {@code Map<String, Object>} and
 * dispatch on {@code eventType}, mirroring the approach used in
 * {@code product-service.ProductAggregateListener}. Trying to bind every
 * message to {@link OrderDeliveredEvent} (a strict record) fails for the
 * off-shape events with
 * {@code Cannot convert from [java.util.LinkedHashMap] to
 * [com.sstore.review.kafka.OrderDeliveredEvent]}.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderEventListener {

    private final PurchaseProofRepository purchaseProofRepository;

    @KafkaListener(
        topics = "#{@environment.getProperty('topics.orders')}",
        groupId = "${spring.kafka.consumer.group-id:review-service}",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @Transactional
    public void onOrderEvent(Map<String, Object> event, Acknowledgment ack) {
        try {
            if (event == null) {
                ack.acknowledge();
                return;
            }
            String type = (String) event.get("eventType");
            if (!"OrderDelivered".equals(type)) {
                // We only care about OrderDelivered. Acknowledge and move on
                // so we don't infinite-loop on the other event types.
                ack.acknowledge();
                return;
            }
            // OrderDelivered has an `items` list (not `lines` like
            // InventoryReserved). Each item carries productId / sku /
            // quantity; productId is the only field the proof table needs.
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) event.get("items");
            if (items == null || items.isEmpty()) {
                ack.acknowledge();
                return;
            }
            UUID orderId = parseUuid(event.get("orderId"));
            String userId = asString(event.get("userId"));
            Instant deliveredAt = parseInstant(event.get("occurredAt"));
            if (deliveredAt == null) deliveredAt = Instant.now();

            for (Map<String, Object> item : items) {
                UUID productId = parseUuid(item.get("productId"));
                if (productId == null) continue;
                if (userId == null) continue; // can't build a proof without a user
                PurchaseProof proof = PurchaseProof.builder()
                    .userId(userId)
                    .productId(productId)
                    .orderId(orderId)
                    .deliveredAt(deliveredAt)
                    .build();
                // Idempotent: the (user, product, order) UNIQUE constraint
                // swallows duplicates.
                try {
                    purchaseProofRepository.save(proof);
                } catch (org.springframework.dao.DataIntegrityViolationException ignored) {
                    // already cached
                }
            }
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to process order event {}", event, e);
            // Do not ack — let Kafka redeliver. The DB-side UNIQUE makes the
            // replay safe.
        }
    }

    private static UUID parseUuid(Object v) {
        if (v == null) return null;
        try { return UUID.fromString(v.toString()); }
        catch (IllegalArgumentException e) { return null; }
    }

    private static String asString(Object v) {
        return v == null ? null : v.toString();
    }

    private static Instant parseInstant(Object v) {
        if (v == null) return null;
        try { return Instant.parse(v.toString()); }
        catch (Exception e) { return null; }
    }
}
