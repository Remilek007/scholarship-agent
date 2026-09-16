import { createScholarshipRepository, createDatabase, discoveryRecords } from "@scholarship-agent/database";
import type { DiscoveryRecord } from "./index";
import { normalizeDiscoveryRecord } from "./normalize";
import type { EnrichedDiscoveryRecord } from "./enrich";

export interface DiscoveryPersistenceInput {
  record: DiscoveryRecord;
  status?: string;
}

export async function recordDiscoveryProvenance(records: DiscoveryPersistenceInput[], databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return { persisted: 0, skipped: records.length, reason: "DATABASE_URL not configured" };
  const db = createDatabase(databaseUrl);
  for (const item of records) {
    const record = item.record;
    await db.insert(discoveryRecords).values({
      url: record.url,
      originalUrl: record.originalUrl,
      title: record.title,
      source: record.source,
      sourceEngine: record.sourceEngine,
      discoveryMethod: record.discoveryMethod,
      query: record.query,
      status: item.status ?? record.discoveryState ?? "discovered",
      failureReason: record.failureReason
    });
  }
  return { persisted: records.length, skipped: 0 };
}

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
