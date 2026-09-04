package com.sstore.order.kafka;

import com.sstore.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

/**
 * Reacts to PaymentSucceeded / PaymentFailed / PaymentRefunded events on
 * the payments topic and updates the order's payment_status accordingly.
 *
 * The DB write is idempotent (markPaymentSucceeded / markPaymentFailed both
 * short-circuit if the order is already in a terminal state), so re-delivery
 * from Kafka is safe.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventListeners {

    private final OrderService orderService;

    @KafkaListener(topics = "${topics.payments}", groupId = "order-service-payments")
    public void onPaymentEvent(PaymentEvent event, Acknowledgment ack) {
        try {
            switch (event.eventType()) {
                case "PaymentSucceeded" -> orderService.markPaymentSucceeded(event.orderId());
                case "PaymentFailed"    -> orderService.markPaymentFailed(event.orderId());
                case "PaymentRefunded"  -> orderService.markPaymentFailed(event.orderId()); // reuse the failed state path
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
