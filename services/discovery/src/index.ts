import { buildDiscoveryQueries } from "@scholarship-agent/search";
import type { ApplicantProfile } from "@scholarship-agent/shared";
import { persistDiscoveryRecords } from "./persistence";

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

  async plan(profile: ApplicantProfile): Promise<string[]> {
    return buildDiscoveryQueries(profile);
  }

  async search(profile: ApplicantProfile, queries = buildDiscoveryQueries(profile)): Promise<DiscoveryRecord[]> {
    const records: DiscoveryRecord[] = [];
    for (const query of queries) {
      const results = await Promise.allSettled(this.sources.map((source) => source.search(query)));
      for (const result of results) if (result.status === "fulfilled") records.push(...result.value);
    }
    return deduplicateRecords(records);
  }

  async persist(records: DiscoveryRecord[]) {
    return persistDiscoveryRecords(records);
  }
}

function deduplicateRecords(records: DiscoveryRecord[]): DiscoveryRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = canonicalizeUrl(record.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = ""; url.search = ""; url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch { return input.trim().toLowerCase(); }
}

export { createDiscoveryEngine } from "./factory";
export { HttpPageSource } from "./http";
export { normalizeDiscoveryRecord, normalizeDiscoveryRecords } from "./normalize";
export type { NormalizedScholarship } from "./normalize";
