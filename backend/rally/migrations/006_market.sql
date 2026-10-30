CREATE TABLE market_references (
 product_id text PRIMARY KEY REFERENCES catalog_products,
 low_usd_cents integer NOT NULL CHECK(low_usd_cents>0),
 median_usd_cents integer NOT NULL, high_usd_cents integer NOT NULL,
 n integer NOT NULL CHECK(n>0), as_of date NOT NULL,
 CHECK(low_usd_cents<=median_usd_cents AND median_usd_cents<=high_usd_cents)
);
CREATE TABLE market_refresh_attempts (
 product_id text PRIMARY KEY REFERENCES catalog_products,
 attempted_at timestamptz NOT NULL
);
