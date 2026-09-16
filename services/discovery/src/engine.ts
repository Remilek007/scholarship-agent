import type { ApplicantProfile, ScholarshipCandidate } from "@scholarship-agent/shared";
import { planDiscoveryQueries, scoreCandidate } from "@scholarship-agent/search";
import { createScholarshipRepository } from "@scholarship-agent/database";
import { loadDiscoveryConfig } from "./config";
import { enrichDiscoveryRecords } from "./enrich";
import { normalizeDiscoveryRecord } from "./normalize";
import { deduplicateCandidates } from "./quality";
import type { DiscoveryDiagnostics, DiscoveryRecord, ScholarshipSource } from "./index";

export interface DiscoveryRunOptions {
  deepEnrich?: boolean;
  limit?: number;
}

export class DiscoveryEngine {
  constructor(private readonly sources: ScholarshipSource[]) {}

  async health(): Promise<{ sources: Array<{ name: string; healthy: boolean }>; healthy: number; total: number }> {
    const results = await Promise.all(this.sources.map(async source => ({ name: source.name, healthy: source.healthCheck ? await source.healthCheck() : true })));
    return { sources: results, healthy: results.filter(item => item.healthy).length, total: results.length };
  }

  async searchWithDiagnostics(profile: ApplicantProfile, explicitQueries?: string[]): Promise<{ records: DiscoveryRecord[]; diagnostics: DiscoveryDiagnostics }> {
    const queries = explicitQueries?.length ? explicitQueries : planDiscoveryQueries(profile).map(item => item.query);
    const diagnostics: DiscoveryDiagnostics = {
      queries: queries.length,
      sourcesConfigured: this.sources.length,
      sourcesHealthy: 0,
      registrySources: this.sources.filter(source => source.name === "source-registry").length,
      providerSources: this.sources.filter(source => source.name !== "source-registry" && source.name !== "configured-direct-pages").length,
      rawRecords: 0,
      uniqueRecords: 0,
      selectedForEnrichment: 0,
      enriched: 0,
      verified: 0,
      enrichmentErrors: 0,
      providerErrors: [],
      sourceHealth: [],
      sourceResults: []
    };

    const health = await this.health();
    diagnostics.sourceHealth = health.sources;
    diagnostics.sourcesHealthy = health.healthy;

    const records: DiscoveryRecord[] = [];
    for (const source of this.sources) {
      const sourceQueries = source.runOnce ? [queries[0] ?? "scholarship"] : queries;
      let sourceRecords = 0;
      let sourceErrors = 0;
      for (const query of sourceQueries) {
        try {
          const found = await source.search(query);
          records.push(...found);
          sourceRecords += found.length;
        } catch (error) {
          sourceErrors += 1;
          diagnostics.providerErrors.push({ source: source.name, query, error: error instanceof Error ? error.message : "Unknown discovery error" });
        }
      }
      diagnostics.sourceResults.push({ name: source.name, records: sourceRecords, errors: sourceErrors });
    }

    diagnostics.rawRecords = records.length;
    const unique = uniqueDiscoveryRecords(records);
    diagnostics.uniqueRecords = unique.length;
    return { records: unique, diagnostics };
  }

  async searchAndPersist(profile: ApplicantProfile, options: DiscoveryRunOptions = {}): Promise<Record<string, unknown>> {
    const config = loadDiscoveryConfig();
    const searched = await this.searchWithDiagnostics(profile);
    const limit = Math.max(1, Math.min(options.limit ?? config.maxPages, 500));
    const selected = searched.records.slice(0, limit);
    const diagnostics = searched.diagnostics;
    diagnostics.selectedForEnrichment = options.deepEnrich === false ? 0 : Math.min(selected.length, config.maxPages);

    let enriched = selected.map(record => ({ record, candidate: normalizeDiscoveryRecord(record) }));
    if (options.deepEnrich !== false) {
      const results = await enrichDiscoveryRecords(profile, selected, diagnostics.selectedForEnrichment);
      enriched = results.map(result => {
        if (result.enrichmentError) diagnostics.enrichmentErrors += 1;
        if (result.verification) diagnostics.verified += 1;
        return { record: result.record, candidate: result.candidate };
      });
      diagnostics.enriched = enriched.length - diagnostics.enrichmentErrors;
    }

    const candidates = deduplicateCandidates(enriched.map(item => item.candidate as ScholarshipCandidate));
    const repository = process.env.DATABASE_URL ? createScholarshipRepository(process.env.DATABASE_URL) : undefined;
    let persisted = 0;
    if (repository) {
      for (const record of selected) {
        await repository.recordDiscovery({ url: record.url, title: record.title, source: record.source, discoveryMethod: record.discoveryMethod, query: record.query });
      }
      for (const candidate of candidates) {
        const scored = scoreCandidate(profile, candidate);
        if (scored.eligibility === "not_eligible") continue;
        await repository.upsertScholarship({
          canonicalKey: `${candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}::${(candidate.provider ?? "").toLowerCase()}`,
          title: candidate.title,
          provider: candidate.provider,
          university: candidate.university,
          country: candidate.country,
          degreeLevel: candidate.degreeLevel,
          opportunityType: candidate.opportunityType,
          fields: candidate.fields,
          sourceUrl: candidate.sourceUrl,
          applicationUrl: candidate.applicationUrl,
          fundingClass: candidate.fundingClass,
          deadline: candidate.deadline,
          eligibility: candidate.eligibility,
          requirements: candidate.requirements,
          evidence: candidate.evidence
        });
        persisted += 1;
      }
    }

    return {
      profile,
      records: candidates,
      count: candidates.length,
      persisted,
      diagnostics,
      generatedAt: new Date().toISOString()
    };
  }
}

function uniqueDiscoveryRecords(records: DiscoveryRecord[]): DiscoveryRecord[] {
  const seen = new Set<string>();
  return records.filter(record => {
    const key = canonicalUrl(record.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, "");
  }
}
