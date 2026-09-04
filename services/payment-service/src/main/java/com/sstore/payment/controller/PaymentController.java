package com.sstore.payment.controller;

import com.sstore.payment.domain.Payment;
import com.sstore.payment.repository.PaymentRepository;
import com.sstore.payment.service.PaymentService;
import com.sstore.payment.service.RazorpayService;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final RazorpayService razorpayService;
    private final PaymentRepository paymentRepository;

    /**
     * Create (or resume) a Razorpay checkout session for the given order.
     * The order must exist in order-service; we don't re-validate the amount
     * here because order-service is the source of truth and emits an
     * OrderCreated event we can cross-check.
     */
    @PostMapping("/razorpay/session")
    public ResponseEntity<Map<String, Object>> createRazorpaySession(
            @RequestBody CreateSessionRequest request,
            Authentication authentication) throws RazorpayException {

        if (!razorpayService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Razorpay is not configured"));
        }
        if (request.orderId() == null || request.amount() == null || request.currency() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "orderId, amount and currency are required"));
        }

        String userId = authentication.getName();
        Payment payment = paymentService.createOrGetPending(request.orderId(), userId, request.amount(), request.currency());
        String providerOrderId = razorpayService.createProviderOrder(payment);

        Map<String, Object> body = new HashMap<>();
        body.put("paymentId", payment.getId().toString());
        body.put("orderId", payment.getOrderId().toString());
        body.put("keyId", razorpayService.getKeyId());
        body.put("amount", payment.getAmount());
        body.put("currency", razorpayService.getCurrency());
        body.put("razorpayOrderId", providerOrderId);
        if (request.customer() != null) body.put("customer", request.customer());
        return ResponseEntity.ok(body);
    }

    /**
     * Client-side signature verification — the widget calls this from the
     * browser after a successful payment. The webhook is the source of truth;
     * this endpoint exists so the success page can render immediately.
     */
    @PostMapping("/razorpay/verify")
    public ResponseEntity<Map<String, Object>> verifyRazorpayPayment(
            @RequestBody VerifyRequest request,
            Authentication authentication) {
        if (request.paymentId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "paymentId is required"));
        }
        Payment payment;
        try {
            payment = paymentService.requireOwnership(request.paymentId(), authentication.getName());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (payment.getProviderOrderId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payment has no provider order"));
        }
        boolean valid = razorpayService.verifyClientSignature(
                payment.getProviderOrderId(), request.razorpayPaymentId(), request.razorpaySignature());
        if (!valid) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
                    .body(Map.of("error", "Signature verification failed"));
        }
        Payment saved = paymentService.markSucceeded(payment.getId(), request.razorpayPaymentId(), request.razorpaySignature());
        return ResponseEntity.ok(Map.of(
                "paymentId", saved.getId().toString(),
                "status", saved.getStatus()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Payment> get(@PathVariable UUID id, Authentication authentication) {
        return paymentRepository.findById(id)
                .filter(p -> p.getUserId().equals(authentication.getName()))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/by-order/{orderId}")
    public List<Payment> byOrder(@PathVariable UUID orderId, Authentication authentication) {
        return paymentRepository.findByOrderId(orderId).stream()
                .filter(p -> p.getUserId().equals(authentication.getName()))
                .toList();
    }

    @PostMapping("/{id}/refund")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Payment> refund(@PathVariable UUID id, @RequestParam(required = false) Long amount) throws RazorpayException {
        Payment payment = paymentService.refund(id, amount);
        return ResponseEntity.ok(payment);
    }

    public record CreateSessionRequest(
            UUID orderId,
            Long amount,
            String currency,
            Map<String, String> customer
    ) {}

    public record VerifyRequest(
            UUID paymentId,
            String razorpayPaymentId,
            String razorpaySignature
    ) {}
}
