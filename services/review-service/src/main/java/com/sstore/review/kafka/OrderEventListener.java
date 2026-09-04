package com.sstore.review.kafka;

import java.time.Instant;
import java.util.List;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sstore.review.domain.PurchaseProof;
import com.sstore.review.repository.PurchaseProofRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Listens to the `orders` topic. For every OrderDelivered event we cache
 * a purchase_proof row so the review API can verify "did this user actually
 * buy this product?" without a synchronous call to order-service.
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
    public void onOrderEvent(OrderDeliveredEvent event, Acknowledgment ack) {
        try {
            if (event == null || !"OrderDelivered".equals(event.eventType())) {
                ack.acknowledge();
                return;
            }
            if (event.items() == null) {
                ack.acknowledge();
                return;
            }
            Instant deliveredAt = event.occurredAt() != null ? event.occurredAt() : Instant.now();
            for (var item : event.items()) {
                if (item.productId() == null) continue;
                PurchaseProof proof = PurchaseProof.builder()
                    .userId(event.userId())
                    .productId(item.productId())
                    .orderId(event.orderId())
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
}
