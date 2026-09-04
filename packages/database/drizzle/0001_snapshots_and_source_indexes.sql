CREATE TABLE IF NOT EXISTS scholarship_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  title text NOT NULL,
  snippet text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS scholarship_sources_url_idx;
CREATE UNIQUE INDEX IF NOT EXISTS scholarship_sources_scholarship_url_idx
  ON scholarship_sources(scholarship_id, url);
CREATE INDEX IF NOT EXISTS scholarship_sources_url_idx
  ON scholarship_sources(url);

CREATE INDEX IF NOT EXISTS scholarship_snapshots_scholarship_captured_idx
  ON scholarship_snapshots(scholarship_id, captured_at DESC);
