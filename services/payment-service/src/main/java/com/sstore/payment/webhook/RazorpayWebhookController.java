package com.sstore.payment.webhook;

import com.sstore.payment.domain.PaymentStatus;

import com.sstore.payment.domain.Payment;
import com.sstore.payment.domain.WebhookEvent;
import com.sstore.payment.repository.PaymentRepository;
import com.sstore.payment.repository.WebhookEventRepository;
import com.sstore.payment.service.PaymentService;
import com.sstore.payment.service.RazorpayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Razorpay's server-to-server webhook. This is the source of truth for payment
 * success/failure. Every handler must be idempotent — Razorpay will retry on
 * non-2xx, and we dedupe on the X-Razorpay-Event-Id header.
 */
@RestController
@RequestMapping("/api/payments/webhooks")
@RequiredArgsConstructor
@Slf4j
public class RazorpayWebhookController {

    private final RazorpayService razorpayService;
    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final WebhookEventRepository webhookEventRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${razorpay.webhook-secret:}")
    private String webhookSecret;

    @PostMapping(value = "/razorpay", consumes = "application/json")
    @Transactional
    public ResponseEntity<Map<String, String>> handle(
            HttpServletRequest request,
            @RequestHeader(value = "X-Razorpay-Event-Id", required = false) String eventId,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
            @RequestBody String rawBody) {

        if (eventId == null || eventId.isBlank() || signature == null || signature.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing headers"));
        }
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.warn("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured — rejecting");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (!razorpayService.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
            log.warn("Razorpay webhook signature invalid for event {}", eventId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "invalid signature"));
        }

        // Idempotency. The unique (provider, event_id) constraint is a backstop.
        if (webhookEventRepository.findByProviderAndEventId("razorpay", eventId).isPresent()) {
            return ResponseEntity.ok(Map.of("status", "duplicate"));
        }

        Map<String, Object> payload;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(rawBody, Map.class);
            payload = parsed;
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid json"));
        }
        webhookEventRepository.save(WebhookEvent.builder()
                .provider("razorpay")
                .eventId(eventId)
                .payload(payload)
                .build());

        String event = String.valueOf(payload.get("event"));
        try {
            switch (event) {
                case "payment.captured" -> handleCaptured(payload);
                case "payment.failed" -> handleFailed(payload);
                case "refund.processed" -> handleRefund(payload);
                default -> log.info("Ignoring Razorpay event {}", event);
            }
        } catch (Exception e) {
            log.error("Error processing Razorpay webhook {}: {}", eventId, e.toString(), e);
            // Return 5xx so Razorpay retries — but the dedup table stops us from
            // double-processing if the retry lands after we've already advanced
            // the payment row.
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @SuppressWarnings("unchecked")
    private void handleCaptured(Map<String, Object> payload) {
        Map<String, Object> paymentEntity = (Map<String, Object>) ((Map<String, Object>) payload.get("payload")).get("payment");
        Map<String, Object> entity = (Map<String, Object>) paymentEntity.get("entity");
        String orderId = String.valueOf(entity.get("order_id"));
        String paymentId = String.valueOf(entity.get("id"));
        Optional<Payment> payment = paymentRepository.findByProviderAndProviderOrderId("razorpay", orderId);
        payment.ifPresentOrElse(
                p -> paymentService.markSucceeded(p.getId(), paymentId, null),
                () -> log.warn("payment.captured for unknown order {}", orderId)
        );
    }

    @SuppressWarnings("unchecked")
    private void handleFailed(Map<String, Object> payload) {
        Map<String, Object> paymentEntity = (Map<String, Object>) ((Map<String, Object>) payload.get("payload")).get("payment");
        Map<String, Object> entity = (Map<String, Object>) paymentEntity.get("entity");
        String orderId = String.valueOf(entity.get("order_id"));
        String reason = String.valueOf(entity.getOrDefault("error_description", "payment failed"));
        paymentRepository.findByProviderAndProviderOrderId("razorpay", orderId)
                .ifPresent(p -> paymentService.markFailed(p.getId(), reason));
    }

    @SuppressWarnings("unchecked")
    private void handleRefund(Map<String, Object> payload) {
        Map<String, Object> refundEntity = (Map<String, Object>) ((Map<String, Object>) payload.get("payload")).get("refund");
        Map<String, Object> entity = (Map<String, Object>) refundEntity.get("entity");
        String razorpayPaymentId = String.valueOf(entity.get("payment_id"));
        String refundId = String.valueOf(entity.get("id"));
        paymentRepository.findAll().stream()
                .filter(p -> razorpayPaymentId.equals(p.getProviderPaymentId()))
                .findFirst()
                .ifPresent(p -> {
                    p.setStatus(PaymentStatus.REFUNDED.name());
                    p.setProviderRefundId(refundId);
                    p.setRefundedAt(java.time.Instant.now());
                    paymentRepository.save(p);
                });
    }
}
