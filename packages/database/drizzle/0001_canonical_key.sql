CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS canonical_key text;

UPDATE scholarships
SET canonical_key = lower(regexp_replace(trim(title || '::' || coalesce(provider, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
WHERE canonical_key IS NULL;

ALTER TABLE scholarships ALTER COLUMN canonical_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scholarships_canonical_key_idx ON scholarships(canonical_key);
