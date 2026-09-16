ALTER TABLE "discovery_records" ADD COLUMN IF NOT EXISTS "original_url" text;
ALTER TABLE "discovery_records" ADD COLUMN IF NOT EXISTS "source_engine" text;
ALTER TABLE "discovery_records" ADD COLUMN IF NOT EXISTS "failure_reason" text;

CREATE INDEX IF NOT EXISTS "discovery_records_url_idx" ON "discovery_records" USING btree ("url");
CREATE INDEX IF NOT EXISTS "discovery_records_status_idx" ON "discovery_records" USING btree ("status");
CREATE INDEX IF NOT EXISTS "discovery_records_source_idx" ON "discovery_records" USING btree ("source");