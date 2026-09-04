CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS scholarships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL UNIQUE,
  title text NOT NULL,
  provider text,
  university text,
  country text,
  degree_level text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text NOT NULL,
  application_url text,
  funding_class text NOT NULL DEFAULT 'unknown',
  trust_level integer NOT NULL DEFAULT 1,
  deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scholarship_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  url text NOT NULL,
  source_type text NOT NULL,
  is_official boolean NOT NULL DEFAULT false,
  last_verified timestamptz
);

CREATE TABLE IF NOT EXISTS discovery_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  title text,
  source text NOT NULL,
  discovery_method text NOT NULL,
  query text,
  status text NOT NULL DEFAULT 'unprocessed',
  discovered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scholarship_funding (
  scholarship_id uuid PRIMARY KEY REFERENCES scholarships(id) ON DELETE CASCADE,
  tuition_covered boolean,
  stipend_amount text,
  accommodation_covered boolean,
  travel_covered boolean,
  insurance_covered boolean,
  notes text
);

CREATE TABLE IF NOT EXISTS match_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  eligibility_status text NOT NULL,
  field_score real NOT NULL DEFAULT 0,
  funding_score real NOT NULL DEFAULT 0,
  academic_score real NOT NULL DEFAULT 0,
  profile_score real NOT NULL DEFAULT 0,
  overall_score real NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scholarships_deadline_idx ON scholarships(deadline);
CREATE INDEX IF NOT EXISTS scholarships_funding_idx ON scholarships(funding_class);
CREATE INDEX IF NOT EXISTS discovery_records_status_idx ON discovery_records(status);
CREATE UNIQUE INDEX IF NOT EXISTS scholarship_sources_url_idx ON scholarship_sources(url);
