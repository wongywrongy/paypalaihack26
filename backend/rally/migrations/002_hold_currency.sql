-- Existing G1 holds remain USD; no existing payment or domain records are removed.
ALTER TABLE holds ADD COLUMN currency text NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD','CAD','GBP','EUR','AUD'));
