ALTER TABLE negotiation_rounds ADD COLUMN public_event jsonb;
ALTER TABLE negotiations ADD COLUMN error_kind text;
