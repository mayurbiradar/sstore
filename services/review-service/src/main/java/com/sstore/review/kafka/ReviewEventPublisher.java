package com.sstore.review.kafka;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sstore.review.domain.EventOutbox;
import com.sstore.review.repository.EventOutboxRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Writes events to the transactional outbox in the same DB transaction as the
 * business write. The {@link OutboxRelay} drains the table asynchronously and
 * publishes to Kafka.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReviewEventPublisher {

    private final EventOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String topic, String key, String eventType, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            EventOutbox row = EventOutbox.builder()
                .topic(topic)
                .messageKey(key)
                .eventType(eventType)
                .aggregateId(key)
                .payload(json)
                .headers("{}")
                .build();
            outboxRepository.save(row);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize event " + eventType, e);
        }
    }
}
