package com.sstore.product.kafka;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sstore.product.repository.ProductRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Consumes `reviews` events (ReviewApproved / ReviewRejected) and `orders`
 * events (OrderDelivered) to keep the denormalized aggregates on Product
 * (avg_rating, review_count, sold_count) up-to-date.
 *
 * The review-service is the source of truth for review aggregates and ships
 * the precomputed (avgRating, reviewCount) tuple in every ReviewApproved event
 * so we never need to recompute on this side. OrderDelivered carries the line
 * items so we can increment sold_count.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ProductAggregateListener {

    private final ProductRepository productRepository;

    @Value("${topics.reviews}")
    private String reviewsTopic;

    @Value("${topics.orders}")
    private String ordersTopic;

    @KafkaListener(
        topics = "#{@environment.getProperty('topics.reviews')}",
        groupId = "${spring.kafka.consumer.group-id:product-service}",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @Transactional
    public void onReviewEvent(Map<String, Object> event, Acknowledgment ack) {
        try {
            String type = (String) event.get("eventType");
            if ("ReviewApproved".equals(type)) {
                UUID productId = UUID.fromString((String) event.get("productId"));
                BigDecimal avgRating = new BigDecimal(event.get("avgRating").toString());
                int reviewCount = ((Number) event.get("reviewCount")).intValue();
                int updated = productRepository.updateReviewAggregate(productId, avgRating, reviewCount);
                if (updated == 0) {
                    log.warn("ReviewApproved for unknown product {}", productId);
                } else {
                    log.debug("Updated aggregate for product {}: avgRating={}, reviewCount={}",
                              productId, avgRating, reviewCount);
                }
            } else if ("ReviewDeleted".equals(type)) {
                UUID productId = UUID.fromString((String) event.get("productId"));
                BigDecimal avgRating = new BigDecimal(event.get("avgRating").toString());
                int reviewCount = ((Number) event.get("reviewCount")).intValue();
                productRepository.updateReviewAggregate(productId, avgRating, reviewCount);
            }
        } catch (Exception e) {
            log.error("Failed to process review event {}", event, e);
            // Don't ack — let Kafka redeliver. The review-service is idempotent on
            // (productId, avgRating, reviewCount) so retries are safe.
            return;
        }
        ack.acknowledge();
    }

    @KafkaListener(
        topics = "#{@environment.getProperty('topics.orders')}",
        groupId = "${spring.kafka.consumer.group-id:product-service}",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @Transactional
    public void onOrderEvent(Map<String, Object> event, Acknowledgment ack) {
        try {
            String type = (String) event.get("eventType");
            if ("OrderDelivered".equals(type)) {
                List<Map<String, Object>> items = (List<Map<String, Object>>) event.get("items");
                if (items == null) return;
                for (Map<String, Object> item : items) {
                    String productIdStr = (String) item.get("productId");
                    if (productIdStr == null || productIdStr.isBlank()) continue;
                    UUID productId = UUID.fromString(productIdStr);
                    int qty = ((Number) item.get("quantity")).intValue();
                    productRepository.incrementSoldCount(productId, qty);
                }
            }
        } catch (Exception e) {
            log.error("Failed to process order event {}", event, e);
            return;
        }
        ack.acknowledge();
    }

    /** Exposed for testability — not invoked directly. */
    Instant now() { return Instant.now(); }
}
