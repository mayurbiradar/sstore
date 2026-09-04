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

/**
 * Spring Boot 4 / Spring Kafka 4 no longer auto-register the default
 * {@code ConsumerFactory} and {@code kafkaListenerContainerFactory} beans.
 * We declare them explicitly here so {@code @KafkaListener(...)} works.
 *
 * <p>Bootstrap details ({@code spring.kafka.bootstrap-servers}) are bound
 * directly into {@link KafkaClientProperties} so this config doesn't depend
 * on Spring Boot autoconfigure being on the classpath. The deserializer
 * stack is identical to what was previously configured in
 * {@code application.yml}: ErrorHandlingDeserializer wrapping
 * String/Json deserializers, with a JsonDeserializer default type so we can
 * decode heterogeneous event payloads off the same topic.
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
        cfg.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        cfg.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        cfg.put(ErrorHandlingDeserializer.KEY_DESERIALIZER_CLASS, StringDeserializer.class.getName());
        cfg.put(ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS, JsonDeserializer.class.getName());
        cfg.put(JsonDeserializer.TRUSTED_PACKAGES, "com.sstore.*,java.util,java.lang");
        cfg.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        cfg.put(JsonDeserializer.VALUE_DEFAULT_TYPE,
                "com.sstore.product.kafka.ReviewApprovedEvent");
        return new DefaultKafkaConsumerFactory<>(cfg);
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