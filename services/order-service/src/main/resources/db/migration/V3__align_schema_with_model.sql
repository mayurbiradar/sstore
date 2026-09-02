-- Align the order schema with the JPA model.

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS image text;

UPDATE orders
SET status = 'PLACED'
WHERE status = 'CREATED';

ALTER TABLE orders
    ALTER COLUMN status SET DEFAULT 'PLACED';
