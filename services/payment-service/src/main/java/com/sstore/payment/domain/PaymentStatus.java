package com.sstore.payment.domain;

/**
 * Payment lifecycle. Validated at the DB level by a CHECK constraint in V1__init.sql.
 */
public enum PaymentStatus {
    CREATED,
    PENDING,
    AUTHORIZED,
    SUCCEEDED,
    FAILED,
    REFUNDED
}
