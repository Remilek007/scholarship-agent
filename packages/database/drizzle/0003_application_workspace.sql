ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS opportunity_type text NOT NULL DEFAULT 'scholarship';

CREATE INDEX IF NOT EXISTS scholarships_opportunity_type_idx
  ON scholarships(opportunity_type);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'discovered',
  ai_policy text NOT NULL DEFAULT 'unknown',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS applications_scholarship_idx
  ON applications(scholarship_id);

CREATE TABLE IF NOT EXISTS application_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  name text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'missing',
  source_instruction text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_requirements_application_idx
  ON application_requirements(application_id);

CREATE TABLE IF NOT EXISTS application_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  field text NOT NULL,
  answer text NOT NULL,
  ai_policy text NOT NULL DEFAULT 'unknown',
  reviewed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS application_answers_application_field_idx
  ON application_answers(application_id, field);

CREATE TABLE IF NOT EXISTS application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_events_application_idx
  ON application_events(application_id);
