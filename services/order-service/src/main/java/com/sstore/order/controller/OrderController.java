package com.sstore.order.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sstore.order.client.PaymentServiceClient;
import com.sstore.order.domain.Address;
import com.sstore.order.domain.Order;
import com.sstore.order.domain.OrderItem;
import com.sstore.order.repository.AddressRepository;
import com.sstore.order.repository.OrderRepository;
import com.sstore.order.service.OrderService;
import com.sstore.order.service.OrderService.CheckoutMode;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository repo;
    private final OrderService orderService;
    private final AddressRepository addressRepository;

    public OrderController(OrderRepository repo, OrderService orderService, AddressRepository addressRepository) {
        this.repo = repo;
        this.orderService = orderService;
        this.addressRepository = addressRepository;
    }

    // -----------------------------------------------------------------
    // Order CRUD
    // -----------------------------------------------------------------

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Order> list() {
        // JOIN FETCH items so the JSON serialiser can read the collection
        // (open-in-view is disabled).
        return repo.findAllWithItems();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> get(@PathVariable String id, Authentication authentication) {
        Optional<Order> order = repo.findByIdWithItems(UUID.fromString(id));
        if (order.isEmpty()) return ResponseEntity.notFound().build();
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin && !order.get().getUserId().equals(authentication.getName())) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(order.get());
    }

    /**
     * Create an order. Body: an Order JSON with embedded `address` and `items`.
     * For ONLINE payments, follow up with POST /api/orders/{id}/payment-session.
     */
    @PostMapping
    public ResponseEntity<Order> create(@RequestBody Order order, Authentication authentication) {
        String userId = authentication.getName();
        order.setUserId(userId);
        Address address = order.getAddress();
        if (address != null) address.setUserId(userId);
        for (OrderItem item : order.getItems()) item.setOrder(order);
        CheckoutMode mode = "ONLINE".equalsIgnoreCase(order.getPaymentMethod()) ? CheckoutMode.ONLINE : CheckoutMode.COD;
        Order saved = orderService.createOrder(order, address, mode);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * ONLINE-only: ask payment-service to start a Razorpay session for the
     * given order and return the data the widget needs.
     */
    @PostMapping("/{id}/payment-session")
    public ResponseEntity<PaymentServiceClient.PaymentSessionResponse> startPayment(
            @PathVariable UUID id, Authentication authentication) {
        Optional<Order> orderOpt = repo.findById(id);
        if (orderOpt.isEmpty() || !orderOpt.get().getUserId().equals(authentication.getName())) {
            return ResponseEntity.notFound().build();
        }
        Order order = orderOpt.get();
        if (!"ONLINE".equalsIgnoreCase(order.getPaymentMethod())) {
            return ResponseEntity.badRequest().build();
        }
        Map<String, String> customer = new HashMap<>();
        if (order.getAddress() != null) {
            Address a = order.getAddress();
            customer.put("name", ((a.getFirstName() == null ? "" : a.getFirstName())
                    + " " + (a.getLastName() == null ? "" : a.getLastName())).trim());
            customer.put("email", a.getEmail());
            customer.put("contact", a.getPhone());
        }
        return ResponseEntity.ok(orderService.startOnlinePayment(order, customer));
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

    /**
     * Admin status transition: PATCH /api/orders/{id}/status?to=CONFIRMED
     * The actor is recorded in order_status_history and a domain event
     * is emitted so product-service can update sold_count, review-service
     * can re-check purchase verification, etc.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Order> transitionStatus(
            @PathVariable UUID id,
            @RequestParam("to") String toStatus,
            Authentication auth) {
        try {
            orderService.transitionStatus(id, toStatus, "admin:" + auth.getName());
            Order refreshed = repo.findByIdWithItems(id).orElseThrow();
            return ResponseEntity.ok(refreshed);
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    // -----------------------------------------------------------------
    // Address management
    // -----------------------------------------------------------------

    @GetMapping("/users/{userId}/addresses")
    public List<Address> getUserAddresses(@PathVariable("userId") String ignoredUserId, Authentication authentication) {
        return addressRepository.findByUserId(authentication.getName());
    }

    @PostMapping("/users/{userId}/addresses")
    public Address createAddress(@PathVariable("userId") String ignoredUserId, @RequestBody Address address, Authentication authentication) {
        address.setUserId(authentication.getName());
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
        return ResponseEntity.ok(addressRepository.save(address));
    }

    @DeleteMapping("/users/{userId}/addresses/{addressId}")
    public ResponseEntity<Void> deleteAddress(@PathVariable("userId") String ignoredUserId, @PathVariable("addressId") UUID addressId, Authentication authentication) {
        String userId = authentication.getName();
        Optional<Address> address = addressRepository.findById(addressId);
        if (address.isEmpty() || !address.get().getUserId().equals(userId)) {
            return ResponseEntity.notFound().build();
        }
        addressRepository.delete(address.get());
        return ResponseEntity.noContent().build();
    }
}
