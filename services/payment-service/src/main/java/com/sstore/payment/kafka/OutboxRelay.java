package com.sstore.payment.kafka;

import com.sstore.payment.domain.EventOutbox;
import com.sstore.payment.repository.EventOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Drains the event_outbox table to Kafka. Idempotent — if a row was already
 * published, it won't be re-sent. On Kafka failure the row stays unpublished
 * and will be retried on the next tick.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxRelay {

    private final EventOutboxRepository outboxRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Scheduled(fixedDelayString = "${app.outbox.relay-ms:1000}")
    @Transactional
    public void drain() {
        List<EventOutbox> rows = outboxRepository.findUnpublishedForUpdate();
        if (rows.isEmpty()) return;
        for (EventOutbox row : rows) {
            try {
                kafkaTemplate.send(row.getTopic(), row.getMessageKey(), row.getPayload()).get();
                row.setPublishedAt(Instant.now());
                outboxRepository.save(row);
                log.info("Published {} → {} key={}", row.getEventType(), row.getTopic(), row.getMessageKey());
            } catch (Exception e) {
                log.warn("Failed to publish outbox row {} — will retry: {}", row.getId(), e.toString());
                // Don't mark as published. Throwing rolls the whole batch back so the lock is released.
                throw new RuntimeException(e);
            }
        }
    }
}
