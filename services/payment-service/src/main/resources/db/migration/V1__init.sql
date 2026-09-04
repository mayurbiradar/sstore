-- =============================================================================
-- SStore Payment Service — consolidated initial schema
-- =============================================================================
-- Owns all payment state. orderId is a soft reference to order-service's order
-- id (cross-service — no FK). Integrity is enforced at the application/event
-- layer: every orderId we accept must trace back to an OrderCreated event or
-- an authenticated request from a user that owns the order.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id             uuid NOT NULL,
    user_id              text NOT NULL,
    provider             text NOT NULL CHECK (provider IN ('razorpay','stripe')),
    status               text NOT NULL
        CHECK (status IN ('CREATED','PENDING','AUTHORIZED','SUCCEEDED','FAILED','REFUNDED')),
    amount               bigint NOT NULL CHECK (amount >= 0),
    currency             text NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    provider_order_id    text,
    provider_payment_id  text,
    provider_signature   text,
    provider_refund_id   text,
    failure_reason       text,
    metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
    succeeded_at         timestamptz,
    refunded_at          timestamptz,
    expires_at           timestamptz,              -- pending payment intent expiry
    version              bigint NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: a provider order id is unique per provider.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_order
    ON payments(provider, provider_order_id)
    WHERE provider_order_id IS NOT NULL;

-- At most one successful payment per order (no double-charge).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_succeeded_per_order
    ON payments(order_id)
    WHERE status = 'SUCCEEDED';

CREATE INDEX IF NOT EXISTS idx_payments_user   ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_pending_expiry
    ON payments(expires_at)
    WHERE status IN ('CREATED','PENDING');

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id          uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_id            uuid NOT NULL,             -- denormalized for queries
    user_id             text NOT NULL,
    amount              bigint NOT NULL CHECK (amount > 0),
    currency            text NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    reason              text,
    provider_refund_id  text,
    status              text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PROCESSED','FAILED')),
    failure_reason      text,
    initiated_by        text NOT NULL,             -- user sub who triggered it
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    processed_at        timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_provider_id
    ON refunds(provider_refund_id) WHERE provider_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order   ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status  ON refunds(status);

-- ---------------------------------------------------------------------------
-- Webhook event idempotency log
--   We persist the provider's event id + raw payload so a replayed webhook
--   is deduplicated by (provider, event_id) unique constraint.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      text NOT NULL,
    event_id      text NOT NULL,
    event_type    text NOT NULL,
    received_at   timestamptz NOT NULL DEFAULT now(),
    processed_at  timestamptz,
    payload       jsonb NOT NULL,
    UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
    ON webhook_events(received_at)
    WHERE processed_at IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_payment_outbox_unpublished
    ON event_outbox(created_at)
    WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_outbox_aggregate
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

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS trg_refunds_updated_at  ON refunds;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_refunds_updated_at
    BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
