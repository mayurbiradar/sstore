package com.asstore.order.controller;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;

import com.asstore.order.domain.Order;
import com.asstore.order.domain.OrderItem;
import com.asstore.order.repository.OrderRepository;
import com.asstore.order.domain.Address;
import com.asstore.order.service.OrderService;
import com.asstore.order.repository.AddressRepository;
import org.springframework.security.core.Authentication;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
      
    private final OrderRepository repo;
    private final OrderService orderService;
    private final AddressRepository addressRepository;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;
    @Value("${stripe.success-url:http://localhost:5173/order-success}")
    private String stripeSuccessUrl;
    @Value("${stripe.cancel-url:http://localhost:5173/checkout}")
    private String stripeCancelUrl;

    public OrderController(OrderRepository repo, OrderService orderService, AddressRepository addressRepository) {
        this.repo = repo;
        this.orderService = orderService;
        this.addressRepository = addressRepository;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Order> list() { return repo.findAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<Order> get(@PathVariable String id) {
        Optional<Order> order = repo.findById(UUID.fromString(id));
        return order.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Order create(@RequestBody Order order, Authentication authentication) {
        String userId = authentication.getName();
        order.setUserId(userId);
        for (OrderItem item : order.getItems()) {
            item.setOrder(order);
        }
        order.setStatus("PLACED");
        // Assume address is included in order object as 'address'
        Address address = order.getAddress();
        address.setUserId(userId);
        return orderService.createOrder(order, address);
    }

    @PostMapping("/stripe/session")
    public ResponseEntity<Map<String, String>> createStripeSession(@RequestBody Order order, Authentication authentication) throws StripeException {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Stripe is not configured. Set STRIPE_SECRET_KEY in STS."));
        }
        order.setUserId(authentication.getName());
        order.setStatus("PENDING_PAYMENT");
        for (OrderItem item : order.getItems()) item.setOrder(order);
        Address address = order.getAddress();
        address.setUserId(authentication.getName());
        Order savedOrder = orderService.createOrder(order, address);

        Stripe.apiKey = stripeSecretKey;
        SessionCreateParams.Builder sessionBuilder = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setSuccessUrl(stripeSuccessUrl + "?order_id=" + savedOrder.getId() + "&session_id={CHECKOUT_SESSION_ID}")
            .setCancelUrl(stripeCancelUrl)
            .setClientReferenceId(savedOrder.getId().toString());
        for (OrderItem item : savedOrder.getItems()) {
            SessionCreateParams.LineItem.PriceData.ProductData product = SessionCreateParams.LineItem.PriceData.ProductData.builder()
                .setName(item.getProductName())
                .build();
            SessionCreateParams.LineItem.PriceData price = SessionCreateParams.LineItem.PriceData.builder()
                .setCurrency("inr")
                .setUnitAmount(item.getPrice() * 100)
                .setProductData(product)
                .build();
            sessionBuilder.addLineItem(SessionCreateParams.LineItem.builder()
                .setQuantity(item.getQuantity().longValue())
                .setPriceData(price)
                .build());
        }
        Session session = Session.create(sessionBuilder.build());
        Map<String, String> response = new HashMap<>();
        response.put("url", session.getUrl());
        response.put("orderId", savedOrder.getId().toString());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/stripe/confirm")
    public ResponseEntity<Order> confirmStripePayment(@org.springframework.web.bind.annotation.RequestParam("order_id") UUID orderId,
                                                       @org.springframework.web.bind.annotation.RequestParam("session_id") String sessionId,
                                                       Authentication authentication) throws StripeException {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) return ResponseEntity.internalServerError().build();
        Optional<Order> existing = repo.findById(orderId);
        if (existing.isEmpty() || !existing.get().getUserId().equals(authentication.getName())) return ResponseEntity.notFound().build();
        Stripe.apiKey = stripeSecretKey;
        Session session = Session.retrieve(sessionId);
        if (!orderId.toString().equals(session.getClientReferenceId()) || !"paid".equals(session.getPaymentStatus())) return ResponseEntity.badRequest().build();
        Order order = existing.get();
        order.setStatus("CONFIRMED");
        return ResponseEntity.ok(repo.save(order));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Order> update(@PathVariable("id") UUID id, @RequestBody Order order) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        order.setId(id);
        return ResponseEntity.ok(repo.save(order));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/count")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Long> getOrderCount() {
        return ResponseEntity.ok(repo.count());
    }
    
    @GetMapping("/revenue")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Double> getTotalRevenue() {
        Double revenue = repo.getTotalRevenue();
        return ResponseEntity.ok(revenue != null ? revenue : 0.0);
    }
    
    @GetMapping("/my")
    public List<Order> getMyOrders(Authentication authentication) {
        return repo.findByUserId(authentication.getName());
    }

    // Address Management Endpoints
    @GetMapping("/users/{userId}/addresses")
    public List<Address> getUserAddresses(@PathVariable("userId") String ignoredUserId, Authentication authentication) {
        return addressRepository.findByUserIdAndIsDeleted(authentication.getName(), false);
    }

    @PostMapping("/users/{userId}/addresses")
    public Address createAddress(@PathVariable("userId") String ignoredUserId, @RequestBody Address address, Authentication authentication) {
        address.setUserId(authentication.getName());
        address.setDeleted(false);
        return addressRepository.save(address);
    }

    @PutMapping("/users/{userId}/addresses/{addressId}")
    public ResponseEntity<Address> updateAddress(@PathVariable("userId") String ignoredUserId, @PathVariable("addressId") UUID addressId, @RequestBody Address address, Authentication authentication) {
        String userId = authentication.getName();

        Optional<Address> existingAddress = addressRepository.findById(addressId);
        if (existingAddress.isEmpty() || !existingAddress.get().getUserId().equals(userId)) {
            return ResponseEntity.notFound().build();
        }

        address.setId(addressId);
        address.setUserId(userId);
        address.setDeleted(false);
        return ResponseEntity.ok(addressRepository.save(address));
    }

    @DeleteMapping("/users/{userId}/addresses/{addressId}")
    public ResponseEntity<Void> deleteAddress(@PathVariable("userId") String ignoredUserId, @PathVariable("addressId") UUID addressId, Authentication authentication) {
        String userId = authentication.getName();

        Optional<Address> address = addressRepository.findById(addressId);
        if (address.isEmpty() || !address.get().getUserId().equals(userId)) {
            return ResponseEntity.notFound().build();
        }

        // Soft delete
        Address addr = address.get();
        addr.setDeleted(true);
        addressRepository.save(addr);
        return ResponseEntity.noContent().build();
    }
}
