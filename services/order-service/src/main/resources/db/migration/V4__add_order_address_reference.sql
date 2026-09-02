-- Persist the Address relationship required by Order.address.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS address_id uuid;

UPDATE orders o
SET address_id = (
    SELECT a.id
    FROM addresses a
    WHERE a.user_id = o.user_id
    ORDER BY a.is_deleted ASC, a.id
    LIMIT 1
)
WHERE o.address_id IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM orders WHERE address_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot complete V4: existing orders have no matching address';
    END IF;
END
$$;

ALTER TABLE orders
    ALTER COLUMN address_id SET NOT NULL;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_address
    FOREIGN KEY (address_id) REFERENCES addresses(id);

CREATE INDEX IF NOT EXISTS idx_orders_address ON orders(address_id);
