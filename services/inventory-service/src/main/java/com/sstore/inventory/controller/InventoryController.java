package com.sstore.inventory.controller;

import com.sstore.inventory.domain.InventoryItem;
import com.sstore.inventory.domain.Reservation;
import com.sstore.inventory.domain.ReservationLine;
import com.sstore.inventory.dto.ReservationResponse;
import com.sstore.inventory.repository.InventoryItemRepository;
import com.sstore.inventory.repository.ReservationRepository;
import com.sstore.inventory.service.InventoryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryItemRepository itemRepository;
    private final ReservationRepository reservationRepository;

    /** Public read: how much of a SKU is available right now. */
    @GetMapping("/items/{sku}")
    public ResponseEntity<Map<String, Object>> getItem(@PathVariable String sku) {
        return itemRepository.findBySku(sku)
                .<ResponseEntity<Map<String, Object>>>map(item -> ResponseEntity.ok(Map.of(
                        "sku", item.getSku(),
                        "productId", item.getProductId(),
                        "onHand", item.getOnHand(),
                        "reserved", item.getReserved(),
                        "available", item.getOnHand() - item.getReserved()
                )))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Direct reservation endpoint, used when the order-service calls us
     * synchronously (instead of via the orders topic — the topic is the
     * happy path; this exists as a backstop / for tests).
     */
    @PostMapping("/reservations")
    public ResponseEntity<ReservationResponse> reserve(@Valid @RequestBody ReserveRequest request, Authentication authentication) {
        String userId = authentication.getName();
        List<ReservationLine> lines = request.lines().stream()
                .map(l -> ReservationLine.builder()
                        .sku(l.sku())
                        .productId(l.productId() != null ? l.productId() : UUID.nameUUIDFromBytes(l.sku().getBytes()))
                        .quantity(l.quantity())
                        .build())
                .toList();
        Reservation r = inventoryService.reserve(request.orderId(), userId, lines);
        return ResponseEntity.ok(toResponse(r));
    }

    @GetMapping("/reservations/by-order/{orderId}")
    public ResponseEntity<ReservationResponse> byOrder(@PathVariable UUID orderId) {
        return reservationRepository.findByOrderId(orderId)
                .map(r -> ResponseEntity.ok(toResponse(r)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private ReservationResponse toResponse(Reservation r) {
        // Materialise the lazy Set<ReservationLine> into a list before
        // leaving the @Transactional boundary. With open-in-view: false,
        // touching it after this method would throw LazyInitializationException.
        List<ReservationResponse.Line> lineDtos = r.getLines().stream()
                .map(l -> new ReservationResponse.Line(
                        l.getId(),
                        l.getProductId(),
                        l.getSku(),
                        l.getQuantity()))
                .toList();
        return new ReservationResponse(
                r.getId(),
                r.getOrderId(),
                r.getUserId(),
                r.getStatus(),
                r.getExpiresAt(),
                r.getCommittedAt(),
                r.getReleasedAt(),
                r.getReleaseReason(),
                r.getCreatedAt(),
                r.getUpdatedAt(),
                lineDtos);
    }

    @PostMapping("/reservations/{orderId}/commit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> commit(@PathVariable UUID orderId) {
        inventoryService.commit(orderId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reservations/{orderId}/release")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> release(@PathVariable UUID orderId, @RequestParam(defaultValue = "manual") String reason) {
        inventoryService.release(orderId, reason);
        return ResponseEntity.noContent().build();
    }

    // ----- Admin: stock management -----

    @PostMapping("/admin/items")
    @PreAuthorize("hasRole('ADMIN')")
    public InventoryItem upsertItem(@RequestBody UpsertItemRequest request) {
        return inventoryService.upsertItem(request.productId(), request.sku(), request.name(), request.onHand());
    }

    /**
     * Set the on-hand quantity to an exact value (not a top-up). Used by
     * product-service's edit flow so the admin can set stock = 10 on the
     * edit page without the inventory row silently retaining whatever it had.
     */
    @PutMapping("/admin/items/{productId}/onhand")
    @PreAuthorize("hasRole('ADMIN')")
    public InventoryItem setOnHand(@PathVariable UUID productId, @RequestParam int onHand) {
        return inventoryService.setOnHand(productId, onHand);
    }

    @GetMapping("/admin/items")
    @PreAuthorize("hasRole('ADMIN')")
    public List<InventoryItem> listItems() {
        return itemRepository.findAll();
    }

    @GetMapping("/admin/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> summary() {
        return Map.of("totalOnHand", itemRepository.totalOnHand());
    }

    public record ReserveRequest(
            @NotNull UUID orderId,
            @NotEmpty List<Line> lines
    ) {
        public record Line(
                String sku,
                UUID productId,
                @Min(1) Integer quantity
        ) {}
    }

    public record UpsertItemRequest(
            @NotNull UUID productId,
            @NotNull String sku,
            @NotNull String name,
            @Min(0) int onHand
    ) {}
}
