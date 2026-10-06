ALTER TABLE provider_events RENAME TO webhook_events;
ALTER TABLE webhook_events DROP CONSTRAINT provider_events_verified_check;
ALTER TABLE webhook_events ADD COLUMN headers jsonb NOT NULL DEFAULT '{}';
ALTER TABLE decisions RENAME TO ai_decisions;
ALTER TABLE ai_decisions ADD COLUMN request_text text;
ALTER TABLE ai_decisions DROP CONSTRAINT decisions_buyer_id_group_id_key;
CREATE INDEX latest_decision ON ai_decisions(buyer_id,group_id,created_at DESC);
ALTER TABLE offers ADD COLUMN merchant_id text NOT NULL DEFAULT 'commonplace';
ALTER TABLE offers ADD COLUMN published_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE offers ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE groups ADD COLUMN activated boolean NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN demo boolean NOT NULL DEFAULT true;
ALTER TABLE groups ADD COLUMN preparation_expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes';
ALTER TABLE groups ADD COLUMN needs_attention boolean NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN inventory_reserved integer NOT NULL DEFAULT 5 CHECK(inventory_reserved IN (0,5));
ALTER TABLE groups ADD COLUMN fulfillment_released boolean NOT NULL DEFAULT false;
UPDATE groups SET activated=(status!='preparing'), needs_attention=(status='recovery'),status=CASE status WHEN 'preparing' THEN 'OPEN' WHEN 'open' THEN 'OPEN' WHEN 'settling' THEN 'SETTLING' WHEN 'completed' THEN 'SUCCEEDED' WHEN 'compensating' THEN 'UNWINDING' WHEN 'recovery' THEN 'UNWINDING' WHEN 'failed' THEN 'FAILED' ELSE status END;
ALTER TABLE groups ALTER COLUMN status SET DEFAULT 'OPEN';
ALTER TABLE groups ADD CONSTRAINT workflow_states CHECK(status IN ('OPEN','SETTLING','SUCCEEDED','UNWINDING','FAILED'));
-- Old fixture runs may share an offer. Preserve them as legacy history; every new run is bound to a new immutable offer version.
ALTER TABLE groups ADD COLUMN legacy boolean NOT NULL DEFAULT false;
UPDATE groups SET legacy=true;
CREATE UNIQUE INDEX one_active_offer_group ON groups(offer_id) WHERE status IN ('OPEN','SETTLING','UNWINDING') AND NOT legacy;
ALTER TABLE commitments DROP CONSTRAINT commitments_group_id_buyer_id_key;
ALTER TABLE commitments ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE commitments ADD COLUMN admitted boolean NOT NULL DEFAULT false;
ALTER TABLE commitments ADD COLUMN withdrawn boolean NOT NULL DEFAULT false;
ALTER TABLE commitments ADD COLUMN reservation_expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes';
ALTER TABLE commitments ADD COLUMN authorization_expires_at timestamptz;
ALTER TABLE commitments ADD COLUMN authorization_created_at timestamptz;
ALTER TABLE commitments ADD COLUMN evidence_source text;
ALTER TABLE commitments ADD COLUMN observed_at timestamptz;
ALTER TABLE commitments ADD COLUMN evidence_event_id text REFERENCES webhook_events;
UPDATE commitments SET admitted=authorization_id IS NOT NULL AND void_status IS DISTINCT FROM 'VOIDED';
CREATE UNIQUE INDEX one_active_buyer_group ON commitments(group_id,buyer_id) WHERE active;
DROP INDEX unique_group_payer;
CREATE UNIQUE INDEX unique_group_payer ON commitments(group_id,provider_payer_id) WHERE provider_payer_id IS NOT NULL AND admitted;
ALTER TABLE payment_operations ADD COLUMN lease_until timestamptz;
ALTER TABLE payment_operations ADD COLUMN lease_token uuid;
ALTER TABLE payment_operations ADD COLUMN evidence_source text;
ALTER TABLE payment_operations ADD COLUMN evidence_event_id text REFERENCES webhook_events;
ALTER TABLE jobs ADD COLUMN unresolved_since timestamptz;
CREATE TABLE rate_limits (key text PRIMARY KEY, window_start timestamptz NOT NULL DEFAULT now(), hits integer NOT NULL DEFAULT 1);
CREATE OR REPLACE FUNCTION protect_commitment_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.accepted_terms IS DISTINCT FROM OLD.accepted_terms OR NEW.amount_minor!=OLD.amount_minor OR NEW.currency!=OLD.currency OR NEW.group_id!=OLD.group_id OR NEW.buyer_id!=OLD.buyer_id THEN RAISE EXCEPTION 'Commitment financial terms are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_commitment BEFORE UPDATE ON commitments FOR EACH ROW EXECUTE FUNCTION protect_commitment_terms();

CREATE TABLE payment_observations (id bigserial PRIMARY KEY, commitment_id uuid NOT NULL REFERENCES commitments, kind text NOT NULL, provider_status text, source text NOT NULL CHECK(source IN ('api','webhook','reconciliation','fixture')), event_id text REFERENCES webhook_events, resource_id text, observed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE OR REPLACE FUNCTION protect_group_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.inventory_reserved=0 AND NEW.status NOT IN ('SUCCEEDED','FAILED') THEN RAISE EXCEPTION 'Keep inventory reserved until settlement or cleanup resolves'; END IF;
 IF NEW.offer_id!=OLD.offer_id OR NEW.run_id!=OLD.run_id THEN RAISE EXCEPTION 'Group offer binding is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER group_inventory BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION protect_group_inventory();
