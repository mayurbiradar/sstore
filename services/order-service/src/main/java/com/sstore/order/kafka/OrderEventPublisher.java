package com.sstore.order.kafka;

import com.sstore.order.domain.EventOutbox;
import com.sstore.order.repository.EventOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

/**
 * Transactional outbox. Always use this instead of KafkaTemplate.send()
 * directly from a business handler — that way the DB commit and the Kafka
 * publish are never torn across a crash.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderEventPublisher {

    private final EventOutboxRepository outboxRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String topic, String key, String eventType, Map<String, Object> payload) {
        outboxRepository.save(EventOutbox.builder()
                .topic(topic)
                .messageKey(key)
                .eventType(eventType)
                // The aggregate this event belongs to. In this codebase the
                // aggregate is always the order, and the message key is the
                // order id — so we mirror it. The column exists for indexing
                // (see idx_<svc>_outbox_aggregate in the V1 migration).
                .aggregateId(key)
                .payload(payload)
                .createdAt(Instant.now())
                .build());
    }
}
