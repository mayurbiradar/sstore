package com.sstore.payment.service;

import com.sstore.payment.domain.PaymentStatus;

import com.sstore.payment.domain.Payment;
import com.sstore.payment.repository.PaymentRepository;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Wraps the Razorpay SDK so the rest of the service doesn't need to know about
 * JSONObject / signatures / etc. The signature verification here is the one
 * used by the client-side /razorpay/verify call (UX hint). The webhook is
 * the source of truth — see RazorpayWebhookHandler.
 */
@Service
@Slf4j
public class RazorpayService {

    private final PaymentRepository paymentRepository;

    @Value("${razorpay.key-id:}")
    private String keyId;

    @Value("${razorpay.key-secret:}")
    private String keySecret;

    @Value("${razorpay.currency:INR}")
    private String currency;

    public RazorpayService(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public boolean isConfigured() {
        return keyId != null && !keyId.isBlank() && !keyId.contains("replace_with")
                && keySecret != null && !keySecret.isBlank() && !keySecret.contains("replace_with");
    }

    public String getKeyId() { return keyId; }
    public String getCurrency() { return currency; }

    /**
     * Create a Razorpay order for an existing payment row, then update that row
     * with the provider's order id. Idempotent: if the row already has a
     * providerOrderId we return it instead of creating a duplicate.
     */
    public String createProviderOrder(Payment payment) throws RazorpayException {
        if (!isConfigured()) {
            throw new IllegalStateException("Razorpay is not configured");
        }
        if (payment.getProviderOrderId() != null && !payment.getProviderOrderId().isBlank()) {
            return payment.getProviderOrderId();
        }
        RazorpayClient client = new RazorpayClient(keyId, keySecret);
        JSONObject request = new JSONObject();
        request.put("amount", payment.getAmount());
        request.put("currency", payment.getCurrency());
        request.put("receipt", payment.getOrderId().toString());
        com.razorpay.Order razorpayOrder = client.orders.create(request);
        String providerOrderId = razorpayOrder.get("id");
        payment.setProviderOrderId(providerOrderId);
        payment.setStatus(PaymentStatus.PENDING.name());
        payment.setUpdatedAt(Instant.now());
        paymentRepository.save(payment);
        log.info("Created Razorpay order {} for payment {}", providerOrderId, payment.getId());
        return providerOrderId;
    }

    /**
     * Client-side signature check. Verifies the signature returned by the
     * Razorpay widget. The webhook is the source of truth; this is a fast UX
     * path that lets the user see "payment confirmed" before the webhook lands.
     */
    public boolean verifyClientSignature(String providerOrderId, String providerPaymentId, String signature) {
        if (!isConfigured()) return false;
        JSONObject attributes = new JSONObject();
        attributes.put("razorpay_order_id", providerOrderId);
        attributes.put("razorpay_payment_id", providerPaymentId);
        attributes.put("razorpay_signature", signature);
        try {
            return Utils.verifyPaymentSignature(attributes, keySecret);
        } catch (RazorpayException e) {
            log.warn("Payment signature verification threw: {}", e.toString());
            return false;
        }
    }

    /**
     * Initiate a full or partial refund through Razorpay.
     */
    public String refund(Payment payment, Long amount) throws RazorpayException {
        if (!isConfigured()) throw new IllegalStateException("Razorpay is not configured");
        if (payment.getProviderPaymentId() == null) {
            throw new IllegalStateException("Cannot refund: payment has not been captured");
        }
        RazorpayClient client = new RazorpayClient(keyId, keySecret);
        JSONObject request = new JSONObject();
        request.put("amount", amount != null ? amount : payment.getAmount());
        request.put("payment_id", payment.getProviderPaymentId());
        request.put("speed", "optimum");
        com.razorpay.Refund refund = client.refunds.create(request);
        return refund.get("id");
    }

    /**
     * Verify the HMAC-SHA256 signature on a Razorpay webhook payload.
     */
    public boolean verifyWebhookSignature(String payload, String signature, String secret) {
        try {
            return Utils.verifyWebhookSignature(payload, signature, secret);
        } catch (RazorpayException e) {
            log.warn("Webhook signature verification threw: {}", e.toString());
            return false;
        }
    }
}
