package com.sstore.order.service;

import com.sstore.order.client.InventoryServiceClient;
import com.sstore.order.client.PaymentServiceClient;
import com.sstore.order.domain.Address;
import com.sstore.order.domain.Order;
import com.sstore.order.domain.OrderItem;
import com.sstore.order.domain.OrderStatusHistory;
import com.sstore.order.kafka.OrderEventPublisher;
import com.sstore.order.repository.AddressRepository;
import com.sstore.order.repository.OrderRepository;
import com.sstore.order.repository.OrderStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final OrderRepository orderRepository;
    private final AddressRepository addressRepository;
    private final InventoryServiceClient inventoryClient;
    private final PaymentServiceClient paymentClient;
    private final OrderEventPublisher eventPublisher;

    @Value("${topics.orders}")
    private String ordersTopic;

    public enum CheckoutMode { COD, ONLINE }

    /**
     * Create an order, reserve stock, and emit OrderCreated. The payment
     * service is called separately (startOnlinePayment) for ONLINE orders
     * because we need to return the session payload to the client.
     */
    @Transactional
    public Order createOrder(Order order, Address address, CheckoutMode mode) {
        Address savedAddress;
        if (address != null && address.getId() != null) {
            savedAddress = addressRepository.findById(address.getId())
                    .orElseGet(() -> addressRepository.save(address));
        } else {
            savedAddress = addressRepository.save(address);
        }
        order.setAddress(savedAddress);
        order.setStatus("PLACED");
        order.setPaymentMethod(mode.name());
        order.setPaymentStatus("PENDING");
        for (OrderItem item : order.getItems()) {
            item.setOrder(order);
            if (item.getImage() == null) item.setImage("");
        }
        Order saved = orderRepository.save(order);

        // Synchronous stock reservation — gives the user immediate feedback
        // if anything is out of stock. inventory-service's kafka listener
        // will also see the OrderCreated and try to reserve; that path is
        // idempotent so it's fine.
        inventoryClient.reserve(saved.getId(), saved.getUserId(), List.copyOf(saved.getItems()));

        Map<String, Object> payload = Map.of(
                "eventType", "OrderCreated",
                "orderId", saved.getId().toString(),
                "userId", saved.getUserId(),
                "totalAmount", saved.getTotalAmount(),
                "currency", saved.getCurrency(),
                "paymentMethod", saved.getPaymentMethod(),
                "items", saved.getItems().stream().map(it -> Map.of(
                        "sku", it.getSku(),
                        "productId", it.getProductId() != null ? it.getProductId().toString() : "",
                        "productName", it.getProductName(),
                        "quantity", it.getQuantity())).toList(),
                "placedAt", saved.getPlacedAt().toString()
        );
        eventPublisher.enqueue(ordersTopic, saved.getId().toString(), "OrderCreated", payload);

        return saved;
    }

    /**
     * For ONLINE orders: ask payment-service to start a Razorpay session and
     * store the returned paymentId on the order row. The session payload is
     * returned to the frontend for opening the widget.
     */
    public PaymentServiceClient.PaymentSessionResponse startOnlinePayment(Order order, Map<String, String> customer) {
        // Money convention: every amount in the system is already in the
        // smallest currency unit (paise for INR). Do NOT multiply by 100 here
        // or we'll charge the customer 100x the order total.
        long amount = order.getTotalAmount();
        PaymentServiceClient.PaymentSessionResponse session = paymentClient.createRazorpaySession(
                order.getId(), amount, order.getCurrency(), customer);
        order.setPaymentId(session.paymentId());
        orderRepository.save(order);
        return session;
    }

    @Transactional
    public void markPaymentSucceeded(UUID orderId) {
        orderRepository.findById(orderId).ifPresent(o -> {
            if (o.getPaymentStatus().equals("PAID")) {
                return;
            }
            o.setPaymentStatus("PAID");
            o.setStatus("CONFIRMED");
            o.setUpdatedAt(Instant.now());
            orderRepository.save(o);
        });
    }

    @Transactional
    public void markPaymentFailed(UUID orderId) {
        orderRepository.findById(orderId).ifPresent(o -> {
            if (o.getPaymentStatus().equals("PAID")
                    || o.getPaymentStatus().equals("REFUNDED")) {
                return;
            }
            o.setPaymentStatus("FAILED");
            o.setUpdatedAt(Instant.now());
            orderRepository.save(o);
        });
    }

    /**
     * Generic status transition. Validates the requested transition is
     * allowed in the order lifecycle, records an audit row, persists, and
     * emits the appropriate Kafka event so downstream consumers (review
     * service uses OrderDelivered for purchase verification, product-service
     * uses it for sold_count) can react.
     */
    @Transactional
    public void transitionStatus(UUID orderId, String toStatus, String actor) {
        orderRepository.findById(orderId).ifPresent(o -> {
            String from = o.getStatus();
            if (!isValidTransition(from, toStatus)) {
                throw new IllegalStateException(
                    "Invalid order transition " + from + " -> " + toStatus);
            }
            o.setStatus(toStatus);
            switch (toStatus) {
                case "CONFIRMED" -> o.setConfirmedAt(Instant.now());
                case "SHIPPED"   -> o.setShippedAt(Instant.now());
                case "DELIVERED" -> o.setDeliveredAt(Instant.now());
                case "CANCELLED" -> o.setCancelledAt(Instant.now());
                default -> { /* no timestamp */ }
            }

            // Append audit history.
            var history = new com.sstore.order.domain.OrderStatusHistory();
            history.setOrderId(o.getId());
            history.setFromStatus(from);
            history.setToStatus(toStatus);
            history.setActor(actor);
            orderStatusHistoryRepository.save(history);

            orderRepository.save(o);

            // Emit domain event. Downstream:
            //   - product-service uses DELIVERED to bump sold_count
            //   - review-service uses DELIVERED for purchase verification
            Map<String, Object> payload = Map.of(
                "eventType", "Order" + titleCase(toStatus),
                "orderId", o.getId().toString(),
                "userId", o.getUserId(),
                "items", o.getItems().stream().map(it -> Map.of(
                    "productId", it.getProductId() != null ? it.getProductId().toString() : "",
                    "sku", it.getSku(),
                    "quantity", it.getQuantity()
                )).toList(),
                "occurredAt", Instant.now().toString()
            );
            eventPublisher.enqueue(ordersTopic, o.getId().toString(),
                                   "Order" + titleCase(toStatus), payload);
        });
    }

    private static boolean isValidTransition(String from, String to) {
        // PLACED -> CONFIRMED | CANCELLED
        // CONFIRMED -> PACKED | CANCELLED
        // PACKED -> SHIPPED | CANCELLED
        // SHIPPED -> DELIVERED | RETURNED
        // DELIVERED -> RETURNED
        // CANCELLED | RETURNED are terminal.
        return switch (from) {
            case "PLACED"    -> "CONFIRMED".equals(to) || "CANCELLED".equals(to);
            case "CONFIRMED" -> "PACKED".equals(to) || "CANCELLED".equals(to);
            case "PACKED"    -> "SHIPPED".equals(to) || "CANCELLED".equals(to);
            case "SHIPPED"   -> "DELIVERED".equals(to) || "RETURNED".equals(to);
            case "DELIVERED" -> "RETURNED".equals(to);
            default -> false;
        };
    }

    private static String titleCase(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }
}
