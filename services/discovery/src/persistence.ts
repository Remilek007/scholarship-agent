import { createScholarshipRepository } from "@scholarship-agent/database";
import type { DiscoveryRecord } from "./index";
import { normalizeDiscoveryRecord } from "./normalize";

export async function persistDiscoveryRecords(records: DiscoveryRecord[], databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return { persisted: 0, skipped: records.length, reason: "DATABASE_URL not configured" };

  const repository = createScholarshipRepository(databaseUrl);
  let persisted = 0;

  for (const record of records) {
    const normalized = normalizeDiscoveryRecord(record);
    await repository.upsertScholarship(normalized);
    await repository.recordDiscovery(record);
    persisted += 1;
  }

  return { persisted, skipped: 0 };
}
