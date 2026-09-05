-- =============================================================================
-- SStore Order Service — consolidated initial schema
-- =============================================================================
-- Source of truth for orders and customer addresses. The payment status lives
-- here as a denormalized projection of payment-service state — payment-service
-- emits Kafka events that drive updates.
-- -----------------------------------------------------------------------------
-- Status enums are enforced via CHECK constraints (not Postgres ENUM types)
-- so adding new states never requires a migration; just relax the CHECK.
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Addresses
--   userId is the Keycloak subject (sub claim). Kept as text so we don't have
--   to migrate UUID -> text later when we wire Keycloak.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL,
    label       text,                              -- "Home", "Office", etc.
    first_name  text NOT NULL,
    last_name   text NOT NULL,
    email       text NOT NULL,
    phone       text NOT NULL,
    -- Backward-compatible: keep the legacy `address` column for the storefront,
    -- augmented with `line2` for apt/unit.
    address     text NOT NULL,
    line2       text,
    city        text NOT NULL,
    state       text NOT NULL,
    pincode     text NOT NULL,
    country     text NOT NULL DEFAULT 'IN' CHECK (length(country) = 2),
    is_default  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- A user can have at most one default address.
CREATE UNIQUE INDEX IF NOT EXISTS uq_addresses_one_default_per_user
    ON addresses(user_id) WHERE is_default = true;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         text NOT NULL,
    address_id      uuid NOT NULL REFERENCES addresses(id),
    status          text NOT NULL DEFAULT 'PLACED'
        CHECK (status IN ('PLACED','CONFIRMED','PACKED','SHIPPED','DELIVERED','CANCELLED','RETURNED')),
    payment_status  text NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING','AUTHORIZED','PAID','FAILED','REFUNDED')),
    payment_method  text
        CHECK (payment_method IS NULL OR payment_method IN ('COD','ONLINE')),
    payment_id      text,                          -- payment-service UUID (as text)
    total_amount    bigint NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    currency        text NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    notes           text,
    placed_at       timestamptz NOT NULL DEFAULT now(),
    confirmed_at    timestamptz,
    shipped_at      timestamptz,
    delivered_at    timestamptz,
    cancelled_at    timestamptz,
    version         bigint NOT NULL DEFAULT 0,     -- @Version optimistic lock
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user           ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_placed         ON orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_address        ON orders(address_id);

-- ---------------------------------------------------------------------------
-- Order items (snapshot at purchase time)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   uuid NOT NULL,                    -- product-service id, no FK (cross-service)
    sku          text NOT NULL,
    product_name text NOT NULL,
    image        text,
    price        bigint NOT NULL CHECK (price >= 0),   -- paise at purchase time
    quantity     integer NOT NULL CHECK (quantity > 0),
    subtotal     bigint NOT NULL CHECK (subtotal >= 0),-- price * quantity
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku     ON order_items(sku);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ---------------------------------------------------------------------------
-- Order status history (audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status text,
    to_status   text NOT NULL,
    actor       text NOT NULL,                     -- user sub, "system", "kafka", etc.
    reason      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Transactional outbox (Kafka events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_outbox (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic         text NOT NULL,
    message_key   text NOT NULL,                    -- aggregate id (order id)
    event_type    text NOT NULL,
    aggregate_id  text NOT NULL,                    -- duplicated for index locality
    payload       jsonb NOT NULL,
    headers       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    published_at  timestamptz,
    attempt_count integer NOT NULL DEFAULT 0,
    last_error    text
);

CREATE INDEX IF NOT EXISTS idx_order_outbox_unpublished
    ON event_outbox(created_at)
    WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_outbox_aggregate
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

DROP TRIGGER IF EXISTS trg_orders_updated_at   ON orders;
DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
