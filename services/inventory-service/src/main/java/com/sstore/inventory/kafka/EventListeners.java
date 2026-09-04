package com.sstore.inventory.kafka;

import com.sstore.inventory.domain.ReservationStatus;

import com.sstore.inventory.domain.ReservationLine;
import com.sstore.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Listens on:
 *  - orders  → OrderCreated  (create reservation)
 *  - payments → PaymentSucceeded (commit reservation), PaymentFailed (release)
 *
 * Manual acks: we only commit the offset once the DB transaction succeeds,
 * so a crash mid-handler means the same event is re-delivered. All
 * operations here are idempotent — commit() and release() check status
 * before doing anything.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventListeners {

    private final InventoryService inventoryService;

    @KafkaListener(topics = "${topics.orders}", groupId = "inventory-service-orders")
    public void onOrderEvent(OrderCreatedEvent event, Acknowledgment ack) {
        try {
            if (!"OrderCreated".equals(event.eventType())) {
                ack.acknowledge();
                return;
            }
            if (event.items() == null || event.items().isEmpty()) {
                log.warn("OrderCreated for {} has no items — skipping", event.orderId());
                ack.acknowledge();
                return;
            }
            List<ReservationLine> lines = event.items().stream()
                    .map(i -> ReservationLine.builder()
                            .productId(i.productId() != null ? i.productId() : UUID.nameUUIDFromBytes(i.sku().getBytes()))
                            .sku(i.sku())
                            .quantity(i.quantity() != null ? i.quantity() : 1)
                            .build())
                    .toList();
            inventoryService.reserve(event.orderId(), event.userId(), lines);
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to reserve inventory for order {}: {}", event.orderId(), e.toString(), e);
            // Don't ack — the listener container will redeliver. If the failure
            // is permanent (e.g. unknown SKU), it'll loop forever; in production
            // we'd route to a dead-letter topic. The container is configured
            // with default error handler that logs and re-tries; add
            // DefaultErrorHandler + DeadLetterPublishingRecoverer in a follow-up.
            throw e;
        }
    }

    @KafkaListener(topics = "${topics.payments}", groupId = "inventory-service-payments")
    public void onPaymentEvent(PaymentEvent event, Acknowledgment ack) {
        try {
            switch (event.eventType()) {
                case "PaymentSucceeded" -> inventoryService.commit(event.orderId());
                case "PaymentFailed", "PaymentRefunded" -> inventoryService.release(event.orderId(), event.eventType());
                default -> log.debug("Ignoring payment event {}", event.eventType());
            }
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to handle payment event {} for order {}: {}",
                    event.eventType(), event.orderId(), e.toString(), e);
            throw e;
        }
    }
}
