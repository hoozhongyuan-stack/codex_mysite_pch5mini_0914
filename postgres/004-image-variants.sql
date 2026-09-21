CREATE TABLE IF NOT EXISTS asset_variants (
  asset_id text NOT NULL,
  variant text NOT NULL CHECK (variant IN ('thumb','card','hero')),
  object_key text NOT NULL,
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  size bigint NOT NULL CHECK (size >= 0),
  status text NOT NULL CHECK (status IN ('processing','ready','failed')),
  error text NOT NULL DEFAULT '',
  updated_at text NOT NULL,
  PRIMARY KEY (asset_id,variant)
);
CREATE INDEX IF NOT EXISTS asset_variants_status ON asset_variants(status,updated_at);
