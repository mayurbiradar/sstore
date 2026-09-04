-- =============================================================================
-- SStore Review Service — consolidated initial schema
-- =============================================================================
-- Owns product reviews. Verifies purchases by listening to the `orders` Kafka
-- topic for OrderDelivered events and caching (productId, userId) tuples in
-- the purchase_proofs table.
-- -----------------------------------------------------------------------------
-- Status lifecycle: PENDING -> APPROVED | REJECTED
--   * PENDING is for the ALWAYS_PENDING moderation policy
--   * APPROVED reviews contribute to avg_rating / review_count on the product
--   * REJECTED reviews are hidden but kept for audit
--   * Deleting an APPROVED review recomputes aggregates and emits
--     ReviewDeleted so product-service can decrement
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      uuid NOT NULL,                  -- product-service id (cross-service, no FK)
    user_id         text NOT NULL,                  -- Keycloak sub
    order_id        uuid,                           -- the order that authorised the review (nullable when require-purchase=false)
    rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title           text NOT NULL,
    body            text NOT NULL,
    status          text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    verified_purchase boolean NOT NULL DEFAULT false,
    helpful_count   integer NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
    unhelpful_count integer NOT NULL DEFAULT 0 CHECK (unhelpful_count >= 0),
    rejection_reason text,                          -- populated when status=REJECTED
    moderated_by    text,                           -- admin sub
    moderated_at    timestamptz,
    edit_count      integer NOT NULL DEFAULT 0,
    last_edited_at  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         bigint NOT NULL DEFAULT 0,
    -- One approved review per (product, user, order); pending/rejected can repeat
    -- to allow resubmission after rejection.
    CONSTRAINT uq_review_per_order UNIQUE (product_id, user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_approved
    ON reviews(product_id, created_at DESC)
    WHERE status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_reviews_user
    ON reviews(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_status_pending
    ON reviews(created_at)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_reviews_order
    ON reviews(order_id);

-- ---------------------------------------------------------------------------
-- Helpful votes
--   Users can mark a review as helpful / unhelpful. One vote per user per
--   review; toggling is allowed (delete-then-insert).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_helpful_votes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id    uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id      text NOT NULL,
    is_helpful   boolean NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_helpful_votes_user ON review_helpful_votes(user_id);

-- ---------------------------------------------------------------------------
-- Purchase proofs
--   Cached projection of OrderDelivered events. Used by review-service to
--   answer "has this user actually bought this product?" without a synchronous
--   call to order-service. order-service remains source of truth; we just
--   denormalize for speed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_proofs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      text NOT NULL,
    product_id   uuid NOT NULL,
    order_id     uuid NOT NULL,
    delivered_at timestamptz NOT NULL,
    UNIQUE (user_id, product_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_proofs_user    ON purchase_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_proofs_product ON purchase_proofs(product_id);

-- ---------------------------------------------------------------------------
-- Outbox
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

CREATE INDEX IF NOT EXISTS idx_review_outbox_unpublished
    ON event_outbox(created_at)
    WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_review_outbox_aggregate
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

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
