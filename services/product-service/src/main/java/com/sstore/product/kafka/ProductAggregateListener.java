package com.sstore.product.kafka;

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

@Component
@RequiredArgsConstructor
@Slf4j
public class ProductAggregateListener {

    private final ProductRepository productRepository;

    @Value("${topics.orders}")
    private String ordersTopic;

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

    Instant now() { return Instant.now(); }
}
