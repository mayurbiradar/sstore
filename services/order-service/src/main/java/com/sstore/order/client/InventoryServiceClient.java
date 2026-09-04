package com.sstore.order.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sstore.order.domain.OrderItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Synchronous call into inventory-service to reserve stock when an order is
 * created. We do this in addition to publishing OrderCreated to Kafka so that
 * the API can return a clear "out of stock" error to the user immediately.
 * The kafka path is still the source of truth — the listener is idempotent.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryServiceClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${services.inventory.base-url}")
    private String baseUrl;

    /**
     * Reserve stock for the given items. Throws IllegalStateException on
     * insufficient stock so the caller can fail the order creation.
     */
    public void reserve(UUID orderId, String userId, List<OrderItem> items) {
        List<Map<String, Object>> lines = items.stream().map(item -> {
            Map<String, Object> line = new HashMap<>();
            line.put("sku", item.getSku());
            if (item.getProductId() != null) line.put("productId", item.getProductId().toString());
            line.put("quantity", item.getQuantity());
            return line;
        }).toList();

        Map<String, Object> body = Map.of(
                "orderId", orderId.toString(),
                "lines", lines
        );

        try {
            RestClient client = restClientBuilder.baseUrl(baseUrl).build();
            client.post()
                    .uri("/api/inventory/reservations")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + currentToken())
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 409 || e.getStatusCode().value() == 400) {
                // Surface the upstream `message` (e.g. "Unknown SKU …" or
                // "Insufficient stock for …") instead of the raw JSON
                // envelope, so the caller and the user see a clean reason.
                String upstreamMessage = extractMessage(e.getResponseBodyAsString());
                if (upstreamMessage == null) upstreamMessage = e.getResponseBodyAsString();
                throw new IllegalStateException(upstreamMessage);
            }
            log.warn("Inventory reservation failed: {} {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Inventory service unavailable", e);
        }
    }

    /**
     * Pull the {@code message} field out of a JSON error body. Returns
     * {@code null} if the body isn't JSON or has no message field.
     */
    private static String extractMessage(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonNode node = new ObjectMapper().readTree(body);
            JsonNode msg = node.get("message");
            if (msg != null && msg.isTextual()) return msg.asText();
        } catch (Exception ignored) {
            // Not JSON or malformed — fall through to the raw body.
        }
        return null;
    }

    private String currentToken() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getTokenValue();
        }
        // Anonymous call (e.g. listener-initiated reconciliation) — caller must handle.
        return "";
    }
}
