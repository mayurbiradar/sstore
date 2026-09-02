CREATE TABLE IF NOT EXISTS addresses (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL,
	first_name text NOT NULL,
	last_name text NOT NULL,
	email text NOT NULL,
	phone text NOT NULL,
	address text NOT NULL,
	city text NOT NULL,
	state text NOT NULL,
	pincode text NOT NULL,
	is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE orders ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE addresses ALTER COLUMN user_id TYPE text USING user_id::text;

DROP INDEX IF EXISTS idx_orders_user;
CREATE INDEX idx_orders_user ON orders(user_id);