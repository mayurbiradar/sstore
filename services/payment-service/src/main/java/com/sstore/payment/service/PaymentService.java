package com.sstore.payment.service;

import com.sstore.payment.domain.PaymentProvider;

import com.sstore.payment.domain.PaymentStatus;

import com.sstore.payment.domain.Payment;
import com.sstore.payment.kafka.PaymentEventPublisher;
import com.sstore.payment.repository.PaymentRepository;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Owns the lifecycle of a Payment row. On SUCCEEDED / FAILED / REFUNDED it
 * enqueues a payment event for the outbox relay to publish. Consumers
 * (order-service, inventory-service) react to those events.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentEventPublisher eventPublisher;
    private final RazorpayService razorpayService;

    @Value("${topics.payments}")
    private String paymentsTopic;

    @Transactional
    public Payment createOrGetPending(UUID orderId, String userId, Long amount, String currency) {
        // Reuse a PENDING payment for this order if one exists (idempotent).
        List<Payment> existing = paymentRepository.findByOrderId(orderId);
        for (Payment p : existing) {
            if (p.getStatus().equals(PaymentStatus.PENDING.name())
                    || p.getStatus().equals(PaymentStatus.CREATED.name())) {
                return p;
            }
        }
        Payment payment = Payment.builder()
                .orderId(orderId)
                .userId(userId)
                .provider(PaymentProvider.razorpay.name())
                .status(PaymentStatus.CREATED.name())
                .amount(amount)
                .currency(currency)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        return paymentRepository.save(payment);
    }

    public Payment requireOwnership(UUID paymentId, String userId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        if (!payment.getUserId().equals(userId)) {
            throw new SecurityException("Payment does not belong to user");
        }
        return payment;
    }

    @Transactional
    public Payment markSucceeded(UUID paymentId, String providerPaymentId, String signature) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        if (payment.getStatus().equals(PaymentStatus.SUCCEEDED.name())) {
            return payment; // idempotent
        }
        payment.setStatus(PaymentStatus.SUCCEEDED.name());
        payment.setProviderPaymentId(providerPaymentId);
        payment.setProviderSignature(signature);
        payment.setSucceededAt(Instant.now());
        payment.setUpdatedAt(Instant.now());
        Payment saved = paymentRepository.save(payment);

        eventPublisher.enqueue(paymentsTopic, saved.getOrderId().toString(), "PaymentSucceeded", Map.of(
                "eventType", "PaymentSucceeded",
                "paymentId", saved.getId().toString(),
                "orderId", saved.getOrderId().toString(),
                "provider", saved.getProvider(),
                "providerPaymentId", providerPaymentId,
                "amount", saved.getAmount(),
                "currency", saved.getCurrency(),
                "occurredAt", saved.getSucceededAt().toString()
        ));
        return saved;
    }

    @Transactional
    public Payment markFailed(UUID paymentId, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        if (payment.getStatus().equals(PaymentStatus.FAILED.name())
                || payment.getStatus().equals(PaymentStatus.SUCCEEDED.name())) {
            return payment; // terminal
        }
        payment.setStatus(PaymentStatus.FAILED.name());
        payment.setFailureReason(reason);
        payment.setUpdatedAt(Instant.now());
        Payment saved = paymentRepository.save(payment);

        eventPublisher.enqueue(paymentsTopic, saved.getOrderId().toString(), "PaymentFailed", Map.of(
                "eventType", "PaymentFailed",
                "paymentId", saved.getId().toString(),
                "orderId", saved.getOrderId().toString(),
                "provider", saved.getProvider(),
                "reason", reason,
                "occurredAt", saved.getUpdatedAt().toString()
        ));
        return saved;
    }

    @Transactional
    public Payment refund(UUID paymentId, Long amount) throws RazorpayException {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        if (!payment.getStatus().equals(PaymentStatus.SUCCEEDED.name())) {
            throw new IllegalStateException("Only SUCCEEDED payments can be refunded");
        }
        String refundId = razorpayService.refund(payment, amount);
        payment.setStatus(PaymentStatus.REFUNDED.name());
        payment.setProviderRefundId(refundId);
        payment.setRefundedAt(Instant.now());
        payment.setUpdatedAt(Instant.now());
        Payment saved = paymentRepository.save(payment);

        eventPublisher.enqueue(paymentsTopic, saved.getOrderId().toString(), "PaymentRefunded", Map.of(
                "eventType", "PaymentRefunded",
                "paymentId", saved.getId().toString(),
                "orderId", saved.getOrderId().toString(),
                "amount", amount != null ? amount : saved.getAmount(),
                "currency", saved.getCurrency(),
                "occurredAt", saved.getRefundedAt().toString()
        ));
        return saved;
    }
}
