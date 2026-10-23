CREATE TABLE shopper_sessions (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, role text CHECK(role IN ('shop','hub')),
 shop_id text, read_only boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE login_attempts (ip_hash text PRIMARY KEY, window_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0);
CREATE TABLE catalog_products (id text PRIMARY KEY, public jsonb NOT NULL);
CREATE TABLE catalog_offers (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES catalog_products, shop_id text NOT NULL REFERENCES shops,
 variant text NOT NULL, list_usd integer NOT NULL CHECK(list_usd>0), floor_usd integer NOT NULL CHECK(floor_usd>=0),
 cost_usd integer NOT NULL CHECK(cost_usd>=0 AND cost_usd<=floor_usd), stock integer NOT NULL CHECK(stock>=0), days_on_shelf integer NOT NULL CHECK(days_on_shelf>=0), CHECK(floor_usd<=list_usd)
);
CREATE TABLE shop_policies (shop_id text PRIMARY KEY REFERENCES shops, policy jsonb NOT NULL);
CREATE TABLE bags (id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES shopper_sessions, country text NOT NULL, items jsonb NOT NULL, rules jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX bags_owner ON bags(session_id,created_at);
CREATE TABLE quotes (id uuid PRIMARY KEY, bag_id uuid REFERENCES bags, session_id uuid NOT NULL REFERENCES shopper_sessions, terms jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);
CREATE INDEX quotes_bag ON quotes(bag_id,created_at DESC);
CREATE TABLE orders (
 id uuid PRIMARY KEY, quote_id uuid NOT NULL UNIQUE REFERENCES quotes, session_id uuid NOT NULL REFERENCES shopper_sessions,
 pool_id uuid NOT NULL UNIQUE REFERENCES pools, member_id uuid NOT NULL UNIQUE REFERENCES members,
 state text NOT NULL DEFAULT 'QUOTED', payment_state text NOT NULL DEFAULT 'AWAITING_APPROVAL', fulfillment_state text NOT NULL DEFAULT 'AWAITING_FUNDING',
 final_terms jsonb, paypal_order_id text UNIQUE, ship_by timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_owner ON orders(session_id,created_at DESC);
CREATE TABLE order_reservations (order_id uuid NOT NULL REFERENCES orders, offer_id text NOT NULL REFERENCES catalog_offers, qty integer NOT NULL CHECK(qty=1), state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','consumed','released')), PRIMARY KEY(order_id,offer_id));
CREATE TABLE deal_events (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders, seq integer NOT NULL CHECK(seq>0), data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,seq));
CREATE TABLE order_shipments (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders, shop_id text REFERENCES shops, leg text NOT NULL CHECK(leg IN ('shop_to_hub','hub_to_shopper')), carrier text NOT NULL, tracking text NOT NULL, simulated boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,leg,shop_id));
CREATE UNIQUE INDEX one_export_shipment ON order_shipments(order_id) WHERE leg='hub_to_shopper';
CREATE TABLE order_shop_payments (order_id uuid NOT NULL REFERENCES orders, shop_id text NOT NULL REFERENCES shops, pool_id uuid NOT NULL UNIQUE REFERENCES pools, amount_usd integer NOT NULL CHECK(amount_usd>0), PRIMARY KEY(order_id,shop_id));
CREATE TABLE true_ups (order_id uuid PRIMARY KEY REFERENCES orders, actual_minor integer NOT NULL CHECK(actual_minor>=0), refund_minor integer NOT NULL CHECK(refund_minor>=0), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tracking_operations (order_id uuid PRIMARY KEY REFERENCES orders, request_id text NOT NULL UNIQUE, request jsonb NOT NULL, status text NOT NULL CHECK(status IN ('inflight','pending','unknown','completed','failed')), response jsonb, updated_at timestamptz NOT NULL DEFAULT now());
