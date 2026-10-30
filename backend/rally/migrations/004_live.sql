ALTER TABLE catalog_offers ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE shopper_sessions ADD COLUMN judge_writer boolean NOT NULL DEFAULT false;
CREATE TABLE listing_changes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops, offer_id text REFERENCES catalog_offers,
 session_id uuid NOT NULL REFERENCES shopper_sessions, action text NOT NULL,
 before jsonb NOT NULL, after jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_changes_shop ON listing_changes(shop_id,created_at DESC);
CREATE TABLE shop_write_limits (
 session_id uuid PRIMARY KEY REFERENCES shopper_sessions,
 window_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE shop_policies ADD COLUMN goal_draft jsonb;
