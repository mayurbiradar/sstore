package com.sstore.inventory.service;

import com.sstore.inventory.domain.ReservationStatus;

import com.sstore.inventory.domain.InventoryItem;
import com.sstore.inventory.domain.Reservation;
import com.sstore.inventory.domain.ReservationLine;
import com.sstore.inventory.kafka.PaymentEventPublisher;
import com.sstore.inventory.repository.InventoryItemRepository;
import com.sstore.inventory.repository.ReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Owns stock levels and reservations. All multi-step operations are
 * transactional; the unit of work is "either all lines reserved or none".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final InventoryItemRepository itemRepository;
    private final ReservationRepository reservationRepository;
    private final PaymentEventPublisher eventPublisher;

    @Value("${reservation.ttl-minutes:15}")
    private int reservationTtlMinutes;

    @Value("${topics.orders}")
    private String ordersTopic;

    @Transactional
    public InventoryItem upsertItem(UUID productId, String sku, String name, int onHand) {
        InventoryItem item = itemRepository.findById(productId)
                .orElseGet(() -> InventoryItem.builder()
                        .productId(productId)
                        .sku(sku)
                        .name(name)
                        .onHand(0)
                        .reserved(0)
                        .build());
        item.setSku(sku);
        item.setName(name);
        // Only top up; never let an upsert silently drop stock.
        item.setOnHand(item.getOnHand() + onHand);
        item.setUpdatedAt(Instant.now());
        InventoryItem saved = itemRepository.save(item);
        log.info("Upserted inventory item sku={} on_hand={}", sku, saved.getOnHand());
        return saved;
    }

    /**
     * Set on-hand to an exact value (not a top-up). Used by product-service
     * when admin edits a product's stock so the inventory row mirrors the
     * product row immediately, instead of accumulating on every edit.
     *
     * Clamped at 0 to match upsertItem's behaviour. If the item doesn't
     * exist yet, returns a 404 via the controller's path lookup.
     */
    @Transactional
    public InventoryItem setOnHand(UUID productId, int onHand) {
        InventoryItem item = itemRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No inventory item for productId=" + productId));
        item.setOnHand(Math.max(0, onHand));
        item.setUpdatedAt(Instant.now());
        InventoryItem saved = itemRepository.save(item);
        log.info("Set inventory on_hand sku={} on_hand={}", saved.getSku(), saved.getOnHand());
        return saved;
    }

    @Transactional
    public Reservation reserve(UUID orderId, String userId, List<ReservationLine> lines) {
        // Idempotency: one reservation per orderId (DB unique key enforces this).
        // Re-delivery of OrderCreated — whether the prior reservation is ACTIVE,
        // COMMITTED, EXPIRED, or RELEASED — must short-circuit and not insert a
        // second row. The unique constraint on reservations.order_id is the source
        // of truth; this check avoids the duplicate-key error that would otherwise
        // poison the consumer and cause infinite redelivery.
        var existing = reservationRepository.findByOrderId(orderId);
        if (existing.isPresent()) {
            log.info("Reservation for order {} already exists (status={}) — idempotent skip",
                    orderId, existing.get().getStatus());
            return existing.get();
        }

        Reservation reservation = Reservation.builder()
                .orderId(orderId)
                .userId(userId)
                .status(ReservationStatus.ACTIVE.name())
                .expiresAt(Instant.now().plusSeconds(reservationTtlMinutes * 60L))
                .build();
        for (ReservationLine line : lines) {
            line.setReservation(reservation);
            reservation.getLines().add(line);
        }

        // Lock the rows we need to decrement. Sort by id to avoid deadlocks
        // when two concurrent orders share SKUs.
        List<ReservationLine> sorted = reservation.getLines().stream()
                .sorted((a, b) -> a.getSku().compareTo(b.getSku()))
                .toList();
        for (ReservationLine line : sorted) {
            InventoryItem item = itemRepository.findBySkuForUpdate(line.getSku())
                    .orElseThrow(() -> new IllegalStateException(
                            "Unknown SKU " + line.getSku() + " — register it via admin endpoint first"));
            if (item.getOnHand() - item.getReserved() < line.getQuantity()) {
                throw new IllegalStateException("Insufficient stock for " + line.getSku());
            }
            item.setReserved(item.getReserved() + line.getQuantity());
            item.setUpdatedAt(Instant.now());
            try {
                itemRepository.save(item);
            } catch (OptimisticLockingFailureException e) {
                // Another writer changed the row — the outer tx will retry
                // because we throw. Don't swallow.
                throw e;
            }
        }
        Reservation saved = reservationRepository.save(reservation);

        // Emit InventoryReserved (consumed by anyone who wants a read model).
        eventPublisher.enqueue(ordersTopic, orderId.toString(), "InventoryReserved", Map.of(
                "eventType", "InventoryReserved",
                "orderId", orderId.toString(),
                "reservationId", saved.getId().toString(),
                "userId", userId,
                "lines", sorted.stream().map(l -> Map.of(
                        "sku", l.getSku(),
                        "productId", l.getProductId().toString(),
                        "quantity", l.getQuantity())).toList(),
                "occurredAt", saved.getCreatedAt().toString()
        ));
        return saved;
    }

    @Transactional
    public void commit(UUID orderId) {
        Reservation r = reservationRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalStateException("No reservation for order " + orderId));
        if (!r.getStatus().equals(ReservationStatus.ACTIVE.name())) {
            log.info("commit() for order {} ignored: status={}", orderId, r.getStatus());
            return;
        }
        for (ReservationLine line : r.getLines()) {
            InventoryItem item = itemRepository.findByIdForUpdate(line.getProductId())
                    .orElseThrow(() -> new IllegalStateException("Missing item " + line.getProductId()));
            item.setReserved(Math.max(0, item.getReserved() - line.getQuantity()));
            item.setOnHand(Math.max(0, item.getOnHand() - line.getQuantity()));
            item.setUpdatedAt(Instant.now());
            itemRepository.save(item);
        }
        r.setStatus(ReservationStatus.COMMITTED.name());
        reservationRepository.save(r);
    }

    @Transactional
    public void release(UUID orderId, String reason) {
        var maybe = reservationRepository.findByOrderId(orderId);
        if (maybe.isEmpty()) return;
        Reservation r = maybe.get();
        if (!r.getStatus().equals(ReservationStatus.ACTIVE.name())) {
            return;
        }
        for (ReservationLine line : r.getLines()) {
            InventoryItem item = itemRepository.findByIdForUpdate(line.getProductId())
                    .orElseThrow(() -> new IllegalStateException("Missing item " + line.getProductId()));
            item.setReserved(Math.max(0, item.getReserved() - line.getQuantity()));
            item.setUpdatedAt(Instant.now());
            itemRepository.save(item);
        }
        r.setStatus(ReservationStatus.RELEASED.name());
        reservationRepository.save(r);
        log.info("Released reservation for order {} ({})", orderId, reason);
    }

    @Transactional
    public int sweepExpired() {
        List<Reservation> expired = reservationRepository.findExpired(Instant.now());
        for (Reservation r : expired) {
            for (ReservationLine line : r.getLines()) {
                InventoryItem item = itemRepository.findByIdForUpdate(line.getProductId()).orElse(null);
                if (item != null) {
                    item.setReserved(Math.max(0, item.getReserved() - line.getQuantity()));
                    item.setUpdatedAt(Instant.now());
                    itemRepository.save(item);
                }
            }
            r.setStatus(ReservationStatus.EXPIRED.name());
            reservationRepository.save(r);
        }
        return expired.size();
    }
}
