package com.sstore.review.config;

import java.util.HashMap;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.ContainerProperties.AckMode;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Spring Boot 4 / Spring Kafka 4 no longer auto-register the default
 * {@code ConsumerFactory}, {@code kafkaListenerContainerFactory},
 * {@code ProducerFactory}, or {@code KafkaTemplate} beans. We declare
 * them explicitly here. Topic-creation beans (reviews/orders
 * {@code NewTopic}) remain in {@link KafkaConfig}.
 *
 * <p>The review-service outbox stores payloads as already-serialised JSON
 * strings, so its producer template is {@code KafkaTemplate<String, String>}
 * — the consumer side still uses JsonDeserializer for events it receives.
 */
@Configuration
public class KafkaListenerFactoryConfig {

    @Bean
    @ConfigurationProperties("spring.kafka")
    public KafkaClientProperties kafkaClientProperties() {
        return new KafkaClientProperties();
    }

    // ---- consumer wiring ---------------------------------------------

    @Bean
    public ConsumerFactory<String, Object> consumerFactory(KafkaClientProperties props) {
        Map<String, Object> cfg = new HashMap<>();
        cfg.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, props.getBootstrapServers());
        cfg.put(ConsumerConfig.GROUP_ID_CONFIG, props.getConsumer().getGroupId());
        cfg.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, props.getConsumer().getAutoOffsetReset());
        cfg.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG,
                props.getConsumer().getEnableAutoCommit());
        // Wrap the inner deserialisers in ErrorHandlingDeserializer so a
        // single bad record doesn't poison the consumer; the actual type
        // binding (Class + ObjectMapper) lives on the deserialiser instance
        // returned by errorTolerantJsonDeserializer() below.
        cfg.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        cfg.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        cfg.put(ErrorHandlingDeserializer.KEY_DESERIALIZER_CLASS, StringDeserializer.class.getName());
        cfg.put(ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS, JsonDeserializer.class.getName());
        return new DefaultKafkaConsumerFactory<>(cfg, new StringDeserializer(), errorTolerantJsonDeserializer());
    }

    /**
     * Build a {@link JsonDeserializer} backed by a Jackson 2 {@link ObjectMapper}
     * that knows how to read {@link java.time.Instant} (Java 8 date/time types).
     * Without the {@link JavaTimeModule} the deserialiser throws
     * {@code InvalidDefinitionException: Java 8 date/time type \`java.time.Instant\`
     * not supported by default} on every record.
     *
     * <p>Spring Kafka 4.x replaced the legacy {@code setValueDefaultType(String)}
     * setter with constructor-based type binding — we now pass the target
     * {@code Class} directly to the constructor.</p>
     */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static JsonDeserializer<Object> errorTolerantJsonDeserializer() {
        ObjectMapper mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                // Relax the "must have a handler" check so any future
                // java.time.* field added to an event doesn't blow up.
                .configure(MapperFeature.REQUIRE_HANDLERS_FOR_JAVA8_TIMES, false)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                .build();
        mapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Spring Kafka 4.x: pass Class + ObjectMapper to the constructor
        // instead of using the removed setValueDefaultType(String) setter.
        return new JsonDeserializer<>(
            (Class) com.sstore.review.kafka.OrderDeliveredEvent.class,
            mapper
        );
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
            ConsumerFactory<String, Object> consumerFactory) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.getContainerProperties().setAckMode(AckMode.MANUAL);
        return factory;
    }

    // ---- producer wiring ---------------------------------------------

    @Bean
    public ProducerFactory<String, String> producerFactory(KafkaClientProperties props) {
        Map<String, Object> cfg = new HashMap<>();
        cfg.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, props.getBootstrapServers());
        cfg.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        cfg.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        cfg.put(ProducerConfig.ACKS_CONFIG, "all");
        cfg.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        cfg.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        cfg.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120_000);
        cfg.put(ProducerConfig.RETRIES_CONFIG, 5);
        return new DefaultKafkaProducerFactory<>(cfg);
    }

    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
    }

    /** Mirror of the {@code spring.kafka.*} subtree we need. */
    public static class KafkaClientProperties {
        private String bootstrapServers = "localhost:9092";
        private Consumer consumer = new Consumer();

        public String getBootstrapServers() { return bootstrapServers; }
        public void setBootstrapServers(String bootstrapServers) { this.bootstrapServers = bootstrapServers; }
        public Consumer getConsumer() { return consumer; }
        public void setConsumer(Consumer consumer) { this.consumer = consumer; }

        public static class Consumer {
            private String groupId = "review-service";
            private String autoOffsetReset = "earliest";
            private boolean enableAutoCommit = false;

            public String getGroupId() { return groupId; }
            public void setGroupId(String groupId) { this.groupId = groupId; }
            public String getAutoOffsetReset() { return autoOffsetReset; }
            public void setAutoOffsetReset(String autoOffsetReset) { this.autoOffsetReset = autoOffsetReset; }
            public boolean getEnableAutoCommit() { return enableAutoCommit; }
            public void setEnableAutoCommit(boolean enableAutoCommit) { this.enableAutoCommit = enableAutoCommit; }
        }
    }
}