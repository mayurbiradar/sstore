package com.sstore.product.config;

import java.util.HashMap;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
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
 * {@code ConsumerFactory} and {@code kafkaListenerContainerFactory} beans.
 * We declare them explicitly here so {@code @KafkaListener(...)} works.
 *
 * <p>Bootstrap details ({@code spring.kafka.bootstrap-servers}) are bound
 * directly into {@link KafkaClientProperties} so this config doesn't depend
 * on Spring Boot autoconfigure being on the classpath.
 */
@Configuration
public class KafkaConfig {

    @Bean
    @ConfigurationProperties("spring.kafka")
    public KafkaClientProperties kafkaClientProperties() {
        return new KafkaClientProperties();
    }

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
        // returned by mapJsonDeserializer() below.
        cfg.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        cfg.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        cfg.put(ErrorHandlingDeserializer.KEY_DESERIALIZER_CLASS, StringDeserializer.class.getName());
        cfg.put(ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS, JsonDeserializer.class.getName());
        return new DefaultKafkaConsumerFactory<>(cfg, new StringDeserializer(), mapJsonDeserializer());
    }

    /**
     * Build a {@link JsonDeserializer} backed by a Jackson 2 {@link ObjectMapper}
     * that knows how to read {@link java.time.Instant} (Java 8 date/time types).
     * Without the {@link JavaTimeModule} the deserialiser throws on every event
     * whose payload carries an {@code Instant} field.
     *
     * <p>The {@code orders} topic is shared across multiple event types
     * ({@code OrderCreated}, {@code InventoryReserved},
     * …) with different field shapes. Binding every message to a single typed
     * record silently coerces off-shape payloads into that record, dropping
     * fields and breaking conversion into {@code Map<String,Object>} on the
     * listener side. We therefore default to {@code Map.class} so heterogeneous
     * events all deserialize into a generic map, and let the listener dispatch
     * on {@code eventType}.</p>
     */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static JsonDeserializer<Object> mapJsonDeserializer() {
        ObjectMapper mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .configure(MapperFeature.REQUIRE_HANDLERS_FOR_JAVA8_TIMES, false)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                .build();
        mapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Spring Kafka 4.x: pass Class + ObjectMapper to the constructor
        // instead of using the removed setValueDefaultType(String) setter.
        return new JsonDeserializer<>((Class) Map.class, mapper);
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

    /** Mirror of the {@code spring.kafka.*} subtree we need. */
    public static class KafkaClientProperties {
        private String bootstrapServers = "localhost:9092";
        private Consumer consumer = new Consumer();

        public String getBootstrapServers() { return bootstrapServers; }
        public void setBootstrapServers(String bootstrapServers) { this.bootstrapServers = bootstrapServers; }
        public Consumer getConsumer() { return consumer; }
        public void setConsumer(Consumer consumer) { this.consumer = consumer; }

        public static class Consumer {
            private String groupId = "product-service";
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