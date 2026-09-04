ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS opportunity_type text NOT NULL DEFAULT 'scholarship';

DROP INDEX IF EXISTS scholarship_sources_url_idx;
CREATE UNIQUE INDEX IF NOT EXISTS scholarship_sources_scholarship_url_idx
  ON scholarship_sources (scholarship_id, url);
CREATE INDEX IF NOT EXISTS scholarship_sources_url_idx
  ON scholarship_sources (url);

CREATE INDEX IF NOT EXISTS scholarships_opportunity_type_idx
  ON scholarships (opportunity_type);
