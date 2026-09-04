package com.sstore.order.client;

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

import java.util.Map;
import java.util.UUID;

/**
 * Synchronous call into payment-service when a user picks the online payment
 * path. Returns the data the frontend needs to open the Razorpay widget.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentServiceClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${services.payment.base-url}")
    private String baseUrl;

    public PaymentSessionResponse createRazorpaySession(UUID orderId, long amount, String currency, Map<String, String> customer) {
        Map<String, Object> body = Map.of(
                "orderId", orderId.toString(),
                "amount", amount,
                "currency", currency,
                "customer", customer
        );
        try {
            return restClientBuilder.baseUrl(baseUrl).build()
                    .post()
                    .uri("/api/payments/razorpay/session")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + currentToken())
                    .body(body)
                    .retrieve()
                    .body(PaymentSessionResponse.class);
        } catch (RestClientResponseException e) {
            log.warn("Payment service session failed: {} {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Payment service unavailable: " + e.getStatusCode(), e);
        }
    }

    private String currentToken() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getTokenValue();
        }
        return "";
    }

    public record PaymentSessionResponse(
            String paymentId,
            String orderId,
            String keyId,
            Long amount,
            String currency,
            String razorpayOrderId,
            Map<String, String> customer
    ) {}
}
