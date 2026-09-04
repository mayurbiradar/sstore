package com.sstore.review.kafka;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sstore.review.domain.EventOutbox;
import com.sstore.review.repository.EventOutboxRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Scheduled relay that drains the event_outbox table and publishes each row
 * to Kafka. Guarantees at-least-once: a row is marked published only after
 * Kafka acks it. Crashes between publish and update result in a duplicate
 * Kafka message on the next sweep, which consumers must be idempotent for.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxRelay {

    private final EventOutboxRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${outbox.batch-size:50}")
    private int batchSize;

    @Value("${outbox.relay-timeout-ms:5000}")
    private long relayTimeoutMs;

    @Scheduled(fixedDelayString = "${outbox.relay-delay-ms:1000}")
    @Transactional
    public void drain() {
        List<EventOutbox> batch = outboxRepository.findUnpublishedForUpdate();
        if (batch.isEmpty()) return;

        int max = Math.min(batch.size(), batchSize);
        for (int i = 0; i < max; i++) {
            EventOutbox row = batch.get(i);
            try {
                kafkaTemplate.send(row.getTopic(), row.getMessageKey(), row.getPayload())
                    .get(relayTimeoutMs, TimeUnit.MILLISECONDS);
                row.setPublishedAt(Instant.now());
                row.setLastError(null);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (ExecutionException | TimeoutException e) {
                row.setAttemptCount(row.getAttemptCount() + 1);
                row.setLastError(e.getMessage());
                log.warn("Outbox publish failed (attempt {}): {}", row.getAttemptCount(), e.getMessage());
            }
        }
        outboxRepository.saveAll(batch);
    }
}
