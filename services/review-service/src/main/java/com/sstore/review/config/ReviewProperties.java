package com.sstore.review.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * All knobs controlling the review feature are here. Every value is overridable
 * per environment via env vars (see application.yml). Production deployments
 * should pin explicit values; defaults are sensible for local dev.
 */
@ConfigurationProperties(prefix = "review")
@Validated
public record ReviewProperties(
    Rating rating,
    Body body,
    Title title,
    Moderation moderation,
    @Min(0) @Max(3650) int editWindowDays,
    boolean requirePurchase,
    HelpfulVote helpfulVote
) {
    public record Rating(@Min(1) @Max(5) int min, @Min(1) @Max(5) int max) {}
    public record Body(@Min(1) int minLength, @Min(1) int maxLength) {}
    public record Title(@Min(0) int minLength, @Min(1) int maxLength) {}
    public record Moderation(Policy policy) {
        public enum Policy { AUTO_APPROVE, ALWAYS_PENDING, ALWAYS_APPROVE }
    }
    public record HelpfulVote(boolean enabled, boolean requireLogin) {}
}
