package com.sstore.order.kafka;

import com.sstore.order.domain.EventOutbox;
import com.sstore.order.repository.EventOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

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
                log.warn("Outbox publish failed for {}: {} — will retry", row.getId(), e.toString());
                throw new RuntimeException(e);
            }
        }
    }
}
