package com.sstore.product.client;

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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Synchronous call into inventory-service. Used by
 * {@link com.sstore.product.controller.ProductController#createWithImage}
 * to auto-register an inventory row the moment a product is created, so
 * that the new product can be reserved on the very first checkout.
 *
 * <p>Without this, every newly created product would 409 on its first
 * order with "Unknown SKU — register it via admin endpoint first" until
 * someone manually POSTed to {@code /api/inventory/admin/items}.</p>
 *
 * <p>Inventory-service's upsert is idempotent — calling it twice with the
 * same {@code productId} and {@code sku} does <strong>not</strong> reset
 * the existing {@code onHand} (the service only tops up). That's the
 * behaviour we want for retries on product creation.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryServiceClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${services.inventory.base-url}")
    private String baseUrl;

    /**
     * Register or top up an inventory row for a newly created product.
     *
     * @param productId the product's UUID (also the PK in inventory_items)
     * @param sku       the product's SKU
     * @param name      the product's display name (denormalised into inventory)
     * @param onHand    initial stock quantity
     * @return the body of the inventory-service response, or {@code null} if
     *         inventory-service was unreachable (in which case we logged and
     *         swallowed the error — see below).
     */
    public Map<String, Object> registerProduct(UUID productId, String sku, String name, int onHand) {
        // Use LinkedHashMap so the JSON property order matches the
        // inventory-service record (productId, sku, name, onHand) and is
        // human-readable in logs.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("productId", productId.toString());
        body.put("sku", sku);
        body.put("name", name);
        body.put("onHand", onHand);

        String token = currentToken();
        if (token.isEmpty()) {
            log.warn("No JWT in security context — cannot register inventory for sku={}. " +
                    "Make sure the caller is authenticated.", sku);
            return null;
        }

        try {
            RestClient client = restClientBuilder.baseUrl(baseUrl).build();
            return client.post()
                    .uri("/api/inventory/admin/items")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException e) {
            // Inventory-service returns a structured 4xx/5xx with a JSON
            // body — log it but do NOT roll back the product creation. The
            // product is still valid; only the inventory side is missing.
            // An admin can register it manually later, and the product
            // creation should not 500 just because inventory-service is
            // temporarily down.
            log.error("Inventory registration failed for sku={} ({}): {}",
                    sku, e.getStatusCode(), e.getResponseBodyAsString());
            return null;
        } catch (Exception e) {
            log.error("Inventory registration threw for sku={}: {}", sku, e.toString(), e);
            return null;
        }
    }

    /**
     * Set on-hand to an exact value (not a top-up). Used by
     * {@link com.sstore.product.controller.ProductController#update} when
     * admin changes a product's stock so the inventory row mirrors the
     * product row. Returns the inventory-service response body, or null on
     * transient failure (logged, never thrown).
     */
    public Map<String, Object> setOnHand(UUID productId, int onHand) {
        String token = currentToken();
        if (token.isEmpty()) {
            log.warn("No JWT in security context — cannot set inventory for productId={}.", productId);
            return null;
        }
        try {
            RestClient client = restClientBuilder.baseUrl(baseUrl).build();
            return client.put()
                    .uri("/api/inventory/admin/items/{productId}/onhand?onHand={onHand}",
                            productId, onHand)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException e) {
            log.error("Inventory setOnHand failed for productId={} ({}): {}",
                    productId, e.getStatusCode(), e.getResponseBodyAsString());
            return null;
        } catch (Exception e) {
            log.error("Inventory setOnHand threw for productId={}: {}", productId, e.toString(), e);
            return null;
        }
    }

    private String currentToken() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getTokenValue();
        }
        return "";
    }
}
