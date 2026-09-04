-- =============================================================================
-- SStore Inventory Service — consolidated initial schema
-- =============================================================================
-- Tracks stock on hand and short-lived reservations that hold stock while a
-- payment is being processed.
-- -----------------------------------------------------------------------------
-- product_id mirrors product-service's id (no cross-service FK). Inventory
-- caches a copy of sku + name so we can answer stock queries even when
-- product-service is unavailable; product-service remains the source of truth
-- for canonical product data.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Inventory items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
    product_id          uuid PRIMARY KEY,
    sku                 text NOT NULL UNIQUE,
    name                text NOT NULL,
    on_hand             integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    reserved            integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    version             bigint NOT NULL DEFAULT 0,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_reserved_le_on_hand CHECK (reserved <= on_hand)
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku             ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock       ON inventory_items(on_hand) WHERE on_hand <= low_stock_threshold;

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     uuid NOT NULL UNIQUE,                -- one reservation per order
    user_id      text NOT NULL,
    status       text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','COMMITTED','RELEASED','EXPIRED')),
    expires_at   timestamptz NOT NULL,
    committed_at timestamptz,
    released_at  timestamptz,
    release_reason text,                              -- EXPIRED|CANCELLED|PAYMENT_FAILED|ADMIN
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_order   ON reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user    ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status  ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_expiring
    ON reservations(expires_at)
    WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Reservation lines (per SKU)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation_lines (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    product_id      uuid NOT NULL,
    sku             text NOT NULL,
    quantity        integer NOT NULL CHECK (quantity > 0),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (reservation_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_lines_product ON reservation_lines(product_id);

-- ---------------------------------------------------------------------------
-- Stock movements (audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      uuid NOT NULL,
    sku             text NOT NULL,
    delta_on_hand   integer NOT NULL DEFAULT 0,        -- +/- change to on_hand
    delta_reserved  integer NOT NULL DEFAULT 0,        -- +/- change to reserved
    reason          text NOT NULL                      -- TOPUP|RESERVE|COMMIT|RELEASE|EXPIRE|ADJUST
        CHECK (reason IN ('TOPUP','RESERVE','COMMIT','RELEASE','EXPIRE','ADJUST')),
    reference_type  text,                              -- ORDER|RESERVATION|MANUAL
    reference_id    text,                              -- order_id, reservation_id, etc.
    actor           text,                              -- user sub or "system"
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reason  ON stock_movements(reason);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref     ON stock_movements(reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- Transactional outbox
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_outbox (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic         text NOT NULL,
    message_key   text NOT NULL,
    event_type    text NOT NULL,
    aggregate_id  text NOT NULL,
    payload       jsonb NOT NULL,
    headers       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    published_at  timestamptz,
    attempt_count integer NOT NULL DEFAULT 0,
    last_error    text
);

CREATE INDEX IF NOT EXISTS idx_inventory_outbox_unpublished
    ON event_outbox(created_at)
    WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_outbox_aggregate
    ON event_outbox(aggregate_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON inventory_items;
DROP TRIGGER IF EXISTS trg_reservations_updated_at    ON reservations;
CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
