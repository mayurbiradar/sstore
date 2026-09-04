package com.sstore.inventory.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Wire-level representation of a {@link com.sstore.inventory.domain.Reservation}.
 *
 * <p>We intentionally do <strong>not</strong> return the JPA entity from
 * controllers. With {@code spring.jpa.open-in-view: false} the
 * {@code OneToMany Set<ReservationLine>} on {@code Reservation} is a lazy
 * proxy at the point Jackson would serialise it, which throws a
 * {@code LazyInitializationException} that bubbles out as a 500 with no
 * useful body. Returning this DTO keeps the response shape stable and
 * decouples the API contract from the persistence model.</p>
 */
public record ReservationResponse(
        UUID id,
        UUID orderId,
        String userId,
        String status,
        Instant expiresAt,
        Instant committedAt,
        Instant releasedAt,
        String releaseReason,
        Instant createdAt,
        Instant updatedAt,
        List<Line> lines
) {
    public record Line(
            UUID id,
            UUID productId,
            String sku,
            Integer quantity
    ) {}
}
