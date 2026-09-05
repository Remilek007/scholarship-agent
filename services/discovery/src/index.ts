import { buildDiscoveryQueries } from "@scholarship-agent/search";
import type { ApplicantProfile } from "@scholarship-agent/shared";
import { persistDiscoveryRecords, persistEnrichedDiscoveryRecords } from "./persistence";
import { enrichDiscoveryRecords } from "./enrich";

export interface DiscoveryRecord {
  url: string;
  title?: string;
  snippet?: string;
  source: string;
  discoveryMethod: string;
  query: string;
}

export interface ScholarshipSource {
  readonly name: string;
  search(query: string): Promise<DiscoveryRecord[]>;
  healthCheck(): Promise<boolean>;
}

export class DiscoveryEngine {
  constructor(private readonly sources: ScholarshipSource[]) {}
  async plan(profile: ApplicantProfile): Promise<string[]> { return buildDiscoveryQueries(profile); }
  async search(profile: ApplicantProfile, queries = buildDiscoveryQueries(profile)): Promise<DiscoveryRecord[]> {
    const records: DiscoveryRecord[] = [];
    for (const query of queries) {
      const results = await Promise.allSettled(this.sources.map((source) => source.search(query)));
      for (const result of results) if (result.status === "fulfilled") records.push(...result.value);
    }
    return deduplicateRecords(records);
  }
  async searchAndPersist(profile: ApplicantProfile, options: { deepEnrich?: boolean; limit?: number } = {}) {
    const records = await this.search(profile);
    if (options.deepEnrich === false) {
      const persistence = await persistDiscoveryRecords(records);
      return { records, persistence, enriched: 0, verified: 0 };
    }

    const enriched = await enrichDiscoveryRecords(profile, records, options.limit);
    const persistence = await persistEnrichedDiscoveryRecords(enriched);
    return {
      records,
      enriched: enriched.map((item) => item.candidate),
      enrichmentErrors: enriched.filter((item) => item.enrichmentError).map((item) => ({ url: item.record.url, error: item.enrichmentError })),
      persistence,
      verified: persistence.verified
    };
  }
  async persist(records: DiscoveryRecord[]) { return persistDiscoveryRecords(records); }
  async health() { return Promise.all(this.sources.map(async (source) => ({ name: source.name, healthy: await source.healthCheck() }))); }
}

function deduplicateRecords(records: DiscoveryRecord[]): DiscoveryRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => { const key = canonicalizeUrl(record.url); if (seen.has(key)) return false; seen.add(key); return true; });
}
function canonicalizeUrl(input: string): string {
  try { const url = new URL(input); url.hash = ""; url.search = ""; url.hostname = url.hostname.toLowerCase(); return url.toString().replace(/\/$/, ""); }
  catch { return input.trim().toLowerCase(); }
}

export { createDiscoveryEngine } from "./factory";
export { HttpPageSource } from "./http";
export { normalizeDiscoveryRecord, normalizeDiscoveryRecords } from "./normalize";
export type { NormalizedScholarship } from "./normalize";
export { verifySource } from "./verification";
export type { VerificationResult, VerificationStatus } from "./verification";
export { extractApplicationRequirements } from "./requirements";
export type { ExtractedRequirement } from "./requirements";
export { deepExtractPage } from "./deep-extract";
export type { DeepExtractionResult } from "./deep-extract";
export { enrichDiscoveryRecords } from "./enrich";
export type { EnrichedDiscoveryRecord } from "./enrich";
export { SOURCE_REGISTRY, getEnabledSourceRegistry, getSourceRegistryUrls } from "./source-registry";
export type { DiscoverySourceDefinition } from "./source-registry";
