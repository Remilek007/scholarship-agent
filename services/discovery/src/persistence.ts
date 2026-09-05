import { createScholarshipRepository } from "@scholarship-agent/database";
import type { DiscoveryRecord } from "./index";
import { normalizeDiscoveryRecord } from "./normalize";
import type { EnrichedDiscoveryRecord } from "./enrich";

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

export async function persistEnrichedDiscoveryRecords(records: EnrichedDiscoveryRecord[], databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return { persisted: 0, skipped: records.length, verified: 0, reason: "DATABASE_URL not configured" };

  const repository = createScholarshipRepository(databaseUrl);
  let persisted = 0;
  let verified = 0;

  for (const item of records) {
    const scholarshipId = await repository.upsertScholarship(item.candidate);
    await repository.recordDiscovery(item.record);
    if (item.verification) {
      await repository.recordVerification(scholarshipId, item.verification);
      verified += 1;
    }
    persisted += 1;
  }

  return { persisted, skipped: 0, verified };
}
