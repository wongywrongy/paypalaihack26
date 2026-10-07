ALTER TABLE offers DROP CONSTRAINT offers_minimum_check;
ALTER TABLE offers DROP CONSTRAINT offers_capacity_check;
ALTER TABLE offers DROP CONSTRAINT offers_inventory_check;
ALTER TABLE offers ADD CHECK(minimum>0 AND capacity>=minimum AND inventory>=capacity);
ALTER TABLE offers ADD COLUMN pricing_model text NOT NULL DEFAULT 'fixed' CHECK(pricing_model IN ('fixed','tiers'));
ALTER TABLE commitments DROP CONSTRAINT commitments_amount_minor_check;
ALTER TABLE commitments ADD CHECK(amount_minor>0);
ALTER TABLE commitments ADD COLUMN settlement_minor integer CHECK(settlement_minor>0 AND settlement_minor<=amount_minor);
ALTER TABLE commitments ADD COLUMN authorized_minor integer;
ALTER TABLE commitments ADD COLUMN captured_minor integer;
ALTER TABLE commitments ADD COLUMN refunded_minor integer;
-- Prior observations validated every resource against the fixed accepted amount.
UPDATE commitments SET authorized_minor=amount_minor WHERE authorization_id IS NOT NULL;
UPDATE commitments SET captured_minor=amount_minor WHERE capture_status IN ('COMPLETED','REFUNDED','REVERSED');
UPDATE commitments SET refunded_minor=amount_minor WHERE refund_status='COMPLETED';
ALTER TABLE payment_operations ADD COLUMN amount_minor integer CHECK(amount_minor>0);
ALTER TABLE payment_observations ADD COLUMN amount_minor integer;
ALTER TABLE runs ADD COLUMN profile text NOT NULL DEFAULT 'legacy' CHECK(profile IN ('legacy','small','large'));
ALTER TABLE runs ADD COLUMN close_seconds integer NOT NULL DEFAULT 600 CHECK(close_seconds BETWEEN 90 AND 1800);
ALTER TABLE buyers ADD COLUMN owner_id uuid;
UPDATE buyers SET owner_id=id;
ALTER TABLE buyers ALTER COLUMN owner_id SET DEFAULT gen_random_uuid();
ALTER TABLE buyers ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX buyers_owner_run ON buyers(owner_id,run_id);
ALTER TABLE groups DROP CONSTRAINT workflow_states;
ALTER TABLE groups ADD CHECK(status IN ('DRAFT','OPEN','SETTLING','SUCCEEDED','UNWINDING','FAILED'));
ALTER TABLE groups ALTER COLUMN offer_id DROP NOT NULL;
ALTER TABLE groups DROP CONSTRAINT groups_inventory_reserved_check;
ALTER TABLE groups ADD CHECK(inventory_reserved>=0);
ALTER TABLE groups ADD COLUMN settlement_snapshot jsonb;
ALTER TABLE groups ADD COLUMN closing boolean NOT NULL DEFAULT false;
CREATE TABLE merchant_policies (id text PRIMARY KEY, version integer NOT NULL, private_terms jsonb NOT NULL);
CREATE TRIGGER immutable_policy BEFORE UPDATE OR DELETE ON merchant_policies FOR EACH ROW EXECUTE FUNCTION protect_offer_terms();
CREATE TABLE catalog_stock (product_id text PRIMARY KEY REFERENCES products, available integer NOT NULL CHECK(available>=0));
CREATE TABLE buyer_requests (
 id uuid PRIMARY KEY, buyer_id uuid NOT NULL REFERENCES buyers, version integer NOT NULL,
 raw_text text NOT NULL, edits jsonb NOT NULL DEFAULT '{}', constraints jsonb,
 status text NOT NULL DEFAULT 'queued', error text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(buyer_id,version)
);
CREATE TABLE compatibility_assessments (
 request_id uuid NOT NULL REFERENCES buyer_requests, product_id text NOT NULL REFERENCES products,
 source_version integer NOT NULL, requirements jsonb NOT NULL, eligible boolean NOT NULL,
 PRIMARY KEY(request_id,product_id)
);
CREATE TABLE negotiations (
 id uuid PRIMARY KEY, group_id uuid NOT NULL REFERENCES groups, request_id uuid NOT NULL REFERENCES buyer_requests,
 product_id text NOT NULL REFERENCES products, status text NOT NULL DEFAULT 'queued', error text,
 model text, started_at timestamptz, expires_at timestamptz, token_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_running_negotiation ON negotiations(group_id) WHERE status IN ('queued','running');
CREATE TABLE negotiation_rounds (
 id bigserial PRIMARY KEY, negotiation_id uuid NOT NULL REFERENCES negotiations, ordinal integer NOT NULL,
 role text NOT NULL, proposal jsonb, valid boolean NOT NULL, private_error text,
 public_summary text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(negotiation_id,ordinal)
);
CREATE TABLE inventory_reservations (
 quote_id text PRIMARY KEY REFERENCES offers, product_id text NOT NULL REFERENCES products,
 units integer NOT NULL CHECK(units>0), expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','consumed','released'))
);
CREATE OR REPLACE FUNCTION protect_group_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.inventory_reserved=0 AND NEW.status NOT IN ('DRAFT','SUCCEEDED','FAILED') THEN RAISE EXCEPTION 'Keep inventory reserved until settlement or cleanup resolves'; END IF;
 IF NEW.run_id!=OLD.run_id OR (NEW.offer_id IS DISTINCT FROM OLD.offer_id AND NOT (OLD.status='DRAFT' AND OLD.offer_id IS NULL AND NEW.status='OPEN')) THEN RAISE EXCEPTION 'Group offer binding is immutable'; END IF;
 IF OLD.settlement_snapshot IS NOT NULL AND NEW.settlement_snapshot IS DISTINCT FROM OLD.settlement_snapshot THEN RAISE EXCEPTION 'Settlement snapshot is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION protect_commitment_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.accepted_terms IS DISTINCT FROM OLD.accepted_terms OR NEW.amount_minor!=OLD.amount_minor OR NEW.currency!=OLD.currency OR NEW.group_id!=OLD.group_id OR NEW.buyer_id!=OLD.buyer_id OR (OLD.settlement_minor IS NOT NULL AND NEW.settlement_minor IS DISTINCT FROM OLD.settlement_minor) THEN RAISE EXCEPTION 'Commitment financial terms are immutable'; END IF;
 RETURN NEW;
END $$;
