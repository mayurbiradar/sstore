package com.sstore.payment.kafka;

import com.sstore.payment.domain.EventOutbox;
import com.sstore.payment.repository.EventOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

/**
 * Writes events to the outbox table inside the caller's transaction. The
 * OutboxRelay polls and publishes to Kafka. This way a DB commit and a Kafka
 * publish never get torn across a crash.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentEventPublisher {

    private final EventOutboxRepository outboxRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String topic, String key, String eventType, Map<String, Object> payload) {
        EventOutbox row = EventOutbox.builder()
                .topic(topic)
                .messageKey(key)
                .eventType(eventType)
                // The aggregate this event belongs to. In this codebase the
                // aggregate is always the order/payment, and the message key
                // is the order id — so we mirror it. The column exists for
                // indexing (see idx_<svc>_outbox_aggregate in the V1 migration).
                .aggregateId(key)
                .payload(payload)
                .createdAt(Instant.now())
                .build();
        outboxRepository.save(row);
        log.debug("Enqueued {} → {} key={}", eventType, topic, key);
    }
}
