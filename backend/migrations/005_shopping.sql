ALTER TABLE runs ADD COLUMN shopping boolean NOT NULL DEFAULT false;
ALTER TABLE buyer_requests ADD COLUMN clarification jsonb;
ALTER TABLE buyer_requests ADD COLUMN error_kind text;
ALTER TABLE buyer_requests ADD COLUMN owner_id uuid;
UPDATE buyer_requests q SET owner_id=b.owner_id FROM buyers b WHERE b.id=q.buyer_id;
ALTER TABLE buyer_requests ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX requests_owner_latest ON buyer_requests(owner_id,created_at DESC);
ALTER TABLE commitments ADD COLUMN request_id uuid REFERENCES buyer_requests;
UPDATE commitments c SET request_id=(SELECT q.id FROM buyer_requests q WHERE q.buyer_id=c.buyer_id AND q.created_at<=c.created_at AND q.status='completed' ORDER BY q.created_at DESC LIMIT 1);
ALTER TABLE commitments ADD COLUMN reconcile_after timestamptz;
ALTER TABLE commitments ADD COLUMN reconcile_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE webhook_events ADD COLUMN raw_body bytea;
CREATE TRIGGER append_only_observations BEFORE UPDATE OR DELETE ON payment_observations FOR EACH ROW EXECUTE FUNCTION protect_offer_terms();
CREATE TRIGGER retain_consent BEFORE DELETE ON commitments FOR EACH ROW EXECUTE FUNCTION protect_offer_terms();
CREATE OR REPLACE FUNCTION protect_commitment_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.accepted_terms IS DISTINCT FROM OLD.accepted_terms OR NEW.amount_minor!=OLD.amount_minor OR NEW.currency!=OLD.currency OR NEW.group_id!=OLD.group_id OR NEW.buyer_id!=OLD.buyer_id OR NEW.request_id IS DISTINCT FROM OLD.request_id OR (OLD.settlement_minor IS NOT NULL AND NEW.settlement_minor IS DISTINCT FROM OLD.settlement_minor) THEN RAISE EXCEPTION 'Commitment financial terms are immutable'; END IF;
 RETURN NEW;
END $$;
