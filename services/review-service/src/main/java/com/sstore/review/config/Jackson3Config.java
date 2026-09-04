// filepath: services/review-service/src/main/java/com/sstore/review/config/Jackson3Config.java
package com.sstore.review.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.ext.javatime.JavaTimeInitializer;
import tools.jackson.databind.json.JsonMapper;

/**
 * Configures the Spring Boot 4 / Jackson 3 {@code ObjectMapper} so that
 * {@link java.time.Instant} (and the rest of the JSR-310 types used by
 * JPA entities) can be serialised to JSON.
 *
 * <p>Spring Boot 4 ships with Jackson 3 ({@code tools.jackson.*}) and the
 * JSR-310 support is <strong>merged into {@code jackson-databind}</strong>
 * (see the {@code jackson-bom} 3.0.4 POM comment:
 * "{@code 19-Mar-2025, tatu: Merged into jackson-databind for Jackson 3.0}").</p>
 *
 * <p>The merged module is exposed via
 * {@link JavaTimeInitializer#getInstance()}, which provides a
 * {@code setupModule(SetupContext)} method but is NOT a
 * {@code JacksonModule} subclass. We wrap it in a tiny adapter so it can
 * be registered via the standard {@code JsonMapper.Builder.addModule}
 * call. We also disable {@code WRITE_DATES_AS_TIMESTAMPS} so Instants come
 * out as ISO-8601 strings instead of epoch numbers, matching what the
 * other SStore services emit.</p>
 */
@Configuration
public class Jackson3Config {

    /**
     * Replace the auto-configured {@code ObjectMapper} with one that has
     * JSR-310 (Instant, LocalDate, etc.) support registered.
     *
     * <p>Defining an {@code ObjectMapper} bean here takes precedence over
     * Spring Boot's {@code JacksonAutoConfiguration}, so the same mapper
     * is used by Spring MVC (for serialising controller responses) and by
     * the {@code ReviewEventPublisher} (for the transactional outbox
     * payload).</p>
     */
    @Bean
    public ObjectMapper objectMapper() {
        return JsonMapper.builder()
                .addModule(new JavaTimeModuleAdapter())
                // Jackson 3 moved date/timestamp toggles out of
                // SerializationFeature into DateTimeFeature. Disable
                // WRITE_DATES_AS_TIMESTAMPS so Instants come out as
                // ISO-8601 strings instead of epoch numbers.
                .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
    }

    /**
     * Thin adapter so {@link JavaTimeInitializer} (which only has
     * {@code setupModule(SetupContext)}) can be passed to
     * {@code JsonMapper.Builder.addModule(JacksonModule)}.
     */
    static final class JavaTimeModuleAdapter extends JacksonModule {

        @Override
        public String getModuleName() {
            return "JavaTimeModuleAdapter";
        }

        @Override
        public tools.jackson.core.Version version() {
            return tools.jackson.core.Version.unknownVersion();
        }

        @Override
        public void setupModule(SetupContext context) {
            JavaTimeInitializer.getInstance().setupModule(context);
        }
    }
}
