CREATE TABLE IF NOT EXISTS products (
 id text PRIMARY KEY, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS offers (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES products, terms jsonb NOT NULL,
 price_minor integer NOT NULL CHECK(price_minor > 0), currency text NOT NULL CHECK(currency='USD'),
 minimum integer NOT NULL CHECK(minimum=5), capacity integer NOT NULL CHECK(capacity=5),
 inventory integer NOT NULL CHECK(inventory=5)
);
CREATE TABLE IF NOT EXISTS runs (
 id uuid PRIMARY KEY, mode text NOT NULL CHECK(mode IN ('fixture','connected')),
 scenario text NOT NULL CHECK(scenario IN ('success','deadline','partial','refund_pending')),
 created_at timestamptz NOT NULL DEFAULT now(), archived boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS buyers (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES runs, name text NOT NULL,
 persona jsonb NOT NULL, invite_hash text UNIQUE, prepared boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, buyer_id uuid NOT NULL REFERENCES buyers,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day'
);
CREATE TABLE IF NOT EXISTS groups (
 id uuid PRIMARY KEY, run_id uuid NOT NULL UNIQUE REFERENCES runs,
 offer_id text NOT NULL REFERENCES offers, status text NOT NULL DEFAULT 'preparing',
 deadline timestamptz, locked_at timestamptz, failure_reason text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS decisions (
 id uuid PRIMARY KEY, buyer_id uuid NOT NULL REFERENCES buyers, group_id uuid NOT NULL REFERENCES groups,
 mode text NOT NULL, status text NOT NULL DEFAULT 'queued', result jsonb, error text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(buyer_id,group_id)
);
CREATE TABLE IF NOT EXISTS commitments (
 id uuid PRIMARY KEY, group_id uuid NOT NULL REFERENCES groups, buyer_id uuid NOT NULL REFERENCES buyers,
 accepted_terms jsonb NOT NULL, amount_minor integer NOT NULL CHECK(amount_minor=6500),
 currency text NOT NULL CHECK(currency='USD'), locked boolean NOT NULL DEFAULT false,
 order_id text UNIQUE, provider_payer_id text, authorization_id text UNIQUE, capture_id text UNIQUE, refund_id text UNIQUE,
 authorization_status text, capture_status text, refund_status text, void_status text,
 approval_url text, error text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(group_id,buyer_id)
);
CREATE TABLE IF NOT EXISTS payment_operations (
 id uuid PRIMARY KEY, commitment_id uuid NOT NULL REFERENCES commitments,
 kind text NOT NULL CHECK(kind IN ('order','authorize','capture','void','refund','refund_recovery')),
 status text NOT NULL DEFAULT 'ready', response jsonb, error text,
 first_attempt_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(commitment_id,kind)
);
CREATE TABLE IF NOT EXISTS provider_events (
 id text PRIMARY KEY, payload jsonb NOT NULL, verified boolean NOT NULL CHECK(verified),
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
ALTER TABLE provider_events ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups;
CREATE INDEX IF NOT EXISTS provider_event_group ON provider_events(group_id);
CREATE TABLE IF NOT EXISTS jobs (
 id bigserial PRIMARY KEY, mode text NOT NULL CHECK(mode IN ('fixture','connected')), kind text NOT NULL, payload jsonb NOT NULL, dedupe_key text UNIQUE NOT NULL,
 status text NOT NULL DEFAULT 'ready', attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, lease_token uuid,
 error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs(mode,available_at) WHERE status IN ('ready','running');
CREATE UNIQUE INDEX IF NOT EXISTS unique_group_payer ON commitments(group_id,provider_payer_id) WHERE provider_payer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commitment_group ON commitments(group_id);
CREATE OR REPLACE FUNCTION protect_offer_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Merchant offer terms are immutable; create a new offer'; END $$;
DROP TRIGGER IF EXISTS immutable_offer ON offers;
CREATE TRIGGER immutable_offer BEFORE UPDATE OR DELETE ON offers FOR EACH ROW EXECUTE FUNCTION protect_offer_terms();
