package com.sstore.review.config;

import java.util.Map;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Value("${topics.reviews}") private String reviewsTopic;
    @Value("${topics.orders}")  private String ordersTopic;

    @Bean
    public NewTopic reviewsTopic() {
        return TopicBuilder.name(reviewsTopic)
            .partitions(3)
            .replicas(1)
            .config("retention.ms", String.valueOf(7L * 24 * 60 * 60 * 1000))
            .config("cleanup.policy", "delete")
            .build();
    }

    @Bean
    public NewTopic ordersTopic() {
        return TopicBuilder.name(ordersTopic)
            .partitions(3)
            .replicas(1)
            .build();
    }
}
