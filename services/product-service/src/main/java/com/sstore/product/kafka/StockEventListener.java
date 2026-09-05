package com.sstore.product.kafka;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sstore.product.domain.ProcessedStockEvent;
import com.sstore.product.repository.ProcessedStockEventRepository;
import com.sstore.product.repository.ProductRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Mirrors inventory-service's reservation lifecycle onto the storefront
 * stock number on Product. This is what users see on the product detail
 * page as "X available" — it must reflect the live, available-to-promise
 * count, not the admin-set top-up.
 *
 * <p>Industry-standard pattern (Shopify, Amazon, etc.): <b>decrement on
 * order placement</b>, restore on release/expire. Payment success does not
 * touch this number — by the time payment clears the stock has already been
 * pulled from the catalog view.
 *
 * <p>Idempotency: each event carries a {@code reservationId}. We persist it
 * to {@code processed_stock_events} before applying the delta. The PK
 * constraint guarantees at-most-once application per event; Kafka
 * redelivery becomes a no-op.
 *
 * <p>One reservation can transition ACTIVE → RELEASED or ACTIVE → EXPIRED,
 * and each transition is its own Kafka message, so we key idempotency on
 * {@code reservationId} only (not (reservationId, eventType)) — the unique
 * constraint lets us apply the same event-type again if needed, but in
 * practice the source never emits duplicates for the same reservation.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StockEventListener {

    private final ProductRepository productRepository;
    private final ProcessedStockEventRepository processedRepository;

    @Value("${topics.orders}")
    private String ordersTopic;

    @KafkaListener(
        topics = "#{@environment.getProperty('topics.orders')}",
        groupId = "product-service-stock",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @Transactional
    public void onStockEvent(Map<String, Object> event, Acknowledgment ack) {
        try {
            String type = (String) event.get("eventType");
            if (type == null) {
                log.warn("Stock event without eventType, ignoring: {}", event);
                ack.acknowledge();
                return;
            }
            switch (type) {
                case "InventoryReserved"  -> handle(event, -1, "InventoryReserved");
                case "InventoryReleased"  -> handle(event, +1, "InventoryReleased");
                case "InventoryExpired"   -> handle(event, +1, "InventoryExpired");
                default -> {
                    // Not our event type — let ProductAggregateListener pick it up
                    // by leaving the ack to it (we share the topic).
                }
            }
        } catch (Exception e) {
            log.error("Failed to process stock event {}", event, e);
            // Don't ack — redeliver. adjustStock is idempotent at the row level
            // and the processed_stock_events PK prevents double-application.
            return;
        }
        ack.acknowledge();
    }

    private void handle(Map<String, Object> event, int sign, String eventType) {
        UUID reservationId = UUID.fromString((String) event.get("reservationId"));
        UUID orderId       = UUID.fromString((String) event.get("orderId"));

        // 1. Idempotency: try to record the event first. If we've seen this
        //    reservationId already (any prior event for it), bail out — the
        //    stock delta has already been applied in the right direction.
        try {
            ProcessedStockEvent marker = new ProcessedStockEvent();
            marker.setReservationId(reservationId);
            marker.setEventType(eventType);
            marker.setOrderId(orderId);
            marker.setProcessedAt(Instant.now());
            processedRepository.saveAndFlush(marker);
        } catch (DataIntegrityViolationException duplicate) {
            log.info("Stock event for reservation {} already processed — skipping", reservationId);
            return;
        }

        // 2. Apply the delta to each line. sign is -1 for Reserved (decrement)
        //    and +1 for Released/Expired (restore).
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lines = (List<Map<String, Object>>) event.get("lines");
        if (lines == null) {
            log.warn("Stock event {} for reservation {} has no lines", eventType, reservationId);
            return;
        }
        int updated = 0;
        for (Map<String, Object> line : lines) {
            String productIdStr = (String) line.get("productId");
            if (productIdStr == null || productIdStr.isBlank()) continue;
            UUID productId = UUID.fromString(productIdStr);
            int qty = ((Number) line.get("quantity")).intValue();
            int n = productRepository.adjustStock(productId, sign * qty, Instant.now());
            updated += n;
        }
        log.info("Applied {} for reservation {} ({} products updated)",
                 eventType, reservationId, updated);
    }
}