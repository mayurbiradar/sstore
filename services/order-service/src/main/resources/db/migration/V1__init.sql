CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Order Service Schema
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    status text DEFAULT 'CREATED',
    total_amount bigint DEFAULT 0,
    currency text DEFAULT 'INR',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid NOT NULL,
    sku text NOT NULL,
    product_name text NOT NULL,
    price bigint NOT NULL,
    quantity integer NOT NULL,
    subtotal bigint NOT NULL
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
