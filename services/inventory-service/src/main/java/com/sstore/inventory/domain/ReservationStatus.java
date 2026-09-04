package com.sstore.inventory.domain;

/**
 * Reservation lifecycle. Validated at the DB level by a CHECK constraint.
 */
public enum ReservationStatus {
    ACTIVE,
    COMMITTED,
    RELEASED,
    EXPIRED
}
