package com.sstore.order;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the order-service bounded context.
 *
 * <p>{@code @EnableScheduling} is required by {@link com.sstore.order.kafka.OutboxRelay},
 * which uses a {@code @Scheduled} method to drain the transactional outbox
 * table and publish events to Kafka. Without it, the relay never runs and
 * events (OrderCreated, OrderConfirmed, ..., OrderDelivered) sit in the
 * {@code event_outbox} table forever with {@code published_at = NULL},
 * starving downstream consumers (review-service's purchase-proof cache,
 * product-service's sold_count updates, etc.).</p>
 */
@SpringBootApplication
@EnableKafka
@EnableScheduling
public class OrderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
