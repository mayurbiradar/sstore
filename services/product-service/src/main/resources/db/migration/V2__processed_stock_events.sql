-- ============================================================================
-- Processed stock events (idempotency log for InventoryReserved / Released /
-- Expired events from inventory-service).
--
-- The orders topic is consumed by multiple handlers; to make the stock
-- adjustments safe against Kafka redelivery and product-service restarts,
-- every event is recorded here keyed by its reservationId. A UNIQUE PK
-- guarantees at-most-once application per event.
--
-- `event_type` is denormalized for ops debugging; the unique constraint is on
-- `reservation_id` alone because a given reservation can legitimately
-- transition through Reserved -> Released/Expired and we apply each
-- transition independently.
-- ============================================================================
CREATE TABLE IF NOT EXISTS processed_stock_events (
    reservation_id  uuid PRIMARY KEY,
    event_type      text NOT NULL,                   -- InventoryReserved|InventoryReleased|InventoryExpired
    order_id        uuid NOT NULL,
    processed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_stock_events_order
    ON processed_stock_events(order_id);