-- Tabs restoring one owned purchase must share one buyer row.
CREATE UNIQUE INDEX one_owner_per_run ON buyers(run_id,owner_id);
