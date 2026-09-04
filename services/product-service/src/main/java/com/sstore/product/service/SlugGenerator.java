package com.sstore.product.service;

import java.text.Normalizer;

/** URL-safe slug derived from a product name. */
public final class SlugGenerator {

    private SlugGenerator() {}

    public static String slugify(String input) {
        String base = input == null ? "" : input.toLowerCase().trim();
        String normalized = Normalizer.normalize(base, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return normalized.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    /** Append a short random suffix to guarantee uniqueness on retry. */
    public static String uniqueSlug(String base) {
        return slugify(base) + "-" + java.util.UUID.randomUUID().toString().substring(0, 6);
    }
}