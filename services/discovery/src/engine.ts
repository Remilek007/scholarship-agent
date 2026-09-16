import type { ApplicantProfile, ScholarshipCandidate } from "@scholarship-agent/shared";
import { planDiscoveryQueries, scoreCandidate } from "@scholarship-agent/search";
import { createScholarshipRepository } from "@scholarship-agent/database";
import { loadDiscoveryConfig } from "./config";
import { enrichDiscoveryRecords } from "./enrich";
import { normalizeDiscoveryRecord } from "./normalize";
import { deduplicateCandidates } from "./quality";
import { recordDiscoveryProvenance } from "./persistence";
import type { DiscoveryDiagnostics, DiscoveryRecord, ScholarshipSource } from "./index";

export interface DiscoveryRunOptions { deepEnrich?: boolean; limit?: number; }

export class DiscoveryEngine {
  constructor(private readonly sources: ScholarshipSource[]) {}

  async health(): Promise<{ sources: Array<{ name: string; healthy: boolean }>; healthy: number; total: number }> {
    const results = await Promise.all(this.sources.map(async source => {
      try {
        return { name: source.name, healthy: source.healthCheck ? await source.healthCheck() : true };
      } catch {
        return { name: source.name, healthy: false };
      }
    }));
    return { sources: results, healthy: results.filter(item => item.healthy).length, total: results.length };
  }

  async searchWithDiagnostics(profile: ApplicantProfile, explicitQueries?: string[]): Promise<{ records: DiscoveryRecord[]; diagnostics: DiscoveryDiagnostics }> {
    const queries = explicitQueries?.length ? explicitQueries : planDiscoveryQueries(profile).map(item => item.query);
    const diagnostics: DiscoveryDiagnostics = {
      queries: queries.length, sourcesConfigured: this.sources.length, sourcesHealthy: 0,
      registrySources: this.sources.filter(source => source.name === "source-registry").length,
      providerSources: this.sources.filter(source => source.name !== "source-registry" && source.name !== "configured-direct-pages").length,
      rawRecords: 0, uniqueRecords: 0, selectedForEnrichment: 0, enriched: 0, verified: 0,
      enrichmentErrors: 0, discovered: 0, extracted: 0, eligible: 0, reviewNeeded: 0,
      crawlPagesVisited: 0, crawlFailures: 0, providerErrors: [], sourceHealth: [], sourceResults: [], crawlErrors: []
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
          const extra = source.diagnostics?.();
          if (extra) {
            diagnostics.crawlPagesVisited += extra.pagesVisited ?? 0;
            for (const failure of extra.failures ?? []) diagnostics.crawlErrors.push({ source: source.name, ...failure });
            diagnostics.crawlFailures += extra.failures?.length ?? 0;
          }
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
    diagnostics.discovered = unique.filter(record => (record.discoveryState ?? "discovered") === "discovered").length;
    diagnostics.extracted = unique.filter(record => record.discoveryState === "extracted").length;
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
    const eligible: ScholarshipCandidate[] = [];
    const candidateStates = new Map<string, "eligible" | "review-needed" | "rejected">();
    for (const candidate of candidates) {
      const scored = scoreCandidate(profile, candidate);
      const key = canonicalCandidateKey(candidate);
      if (scored.eligibility === "not_eligible") {
        candidateStates.set(key, "rejected");
        continue;
      }
      if (scored.eligibility === "cannot_determine") candidateStates.set(key, "review-needed");
      else candidateStates.set(key, "eligible");
      eligible.push(candidate);
    }
    diagnostics.eligible = eligible.filter(candidate => candidateStates.get(canonicalCandidateKey(candidate)) === "eligible").length;
    diagnostics.reviewNeeded = eligible.filter(candidate => candidateStates.get(canonicalCandidateKey(candidate)) === "review-needed").length;

    const persistenceInputs = enriched.map(item => {
      const key = canonicalCandidateKey(item.candidate);
      return {
        record: {
          ...item.record,
          discoveryState: candidateStates.get(key) ?? item.record.discoveryState ?? "review-needed"
        },
        status: candidateStates.get(key) ?? item.record.discoveryState ?? "review-needed"
      };
    });

    let persisted = 0;
    if (process.env.DATABASE_URL) {
      const result = await recordDiscoveryProvenance(persistenceInputs);
      persisted = result.persisted;
      const repository = createScholarshipRepository(process.env.DATABASE_URL);
      for (const candidate of eligible) {
        await repository.upsertScholarship({
          canonicalKey: canonicalCandidateKey(candidate), title: candidate.title, provider: candidate.provider,
          university: candidate.university, country: candidate.country, degreeLevel: candidate.degreeLevel,
          opportunityType: candidate.opportunityType, fields: candidate.fields, sourceUrl: candidate.sourceUrl,
          applicationUrl: candidate.applicationUrl, fundingClass: candidate.fundingClass, deadline: candidate.deadline,
          eligibility: candidate.eligibility, requirements: candidate.requirements
        });
        persisted += 1;
      }
    }

    return { profile, records: candidates, count: candidates.length, persisted, diagnostics, generatedAt: new Date().toISOString() };
  }
}

function uniqueDiscoveryRecords(records: DiscoveryRecord[]): DiscoveryRecord[] {
  const byUrl = new Map<string, DiscoveryRecord>();
  for (const record of records) {
    const key = canonicalUrl(record.url);
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing || recordCompleteness(record) > recordCompleteness(existing)) byUrl.set(key, { ...record, url: key });
  }

  const byIdentity = new Map<string, DiscoveryRecord>();
  for (const record of byUrl.values()) {
    const title = normalizeText(record.title);
    const host = hostOf(record.url);
    const provider = normalizeText((record as DiscoveryRecord & { provider?: string }).provider ?? host ?? record.source);
    const identity = title ? `${title}::${provider}` : canonicalUrl(record.url);
    const existing = byIdentity.get(identity);
    if (!existing || recordCompleteness(record) > recordCompleteness(existing)) byIdentity.set(identity, record);
  }
  return [...byIdentity.values()];
}

function recordCompleteness(record: DiscoveryRecord): number {
  return [record.title, record.snippet, record.sourceUrl, record.originalUrl, record.sourceEngine, record.discoveryState].filter(Boolean).length;
}

function normalizeText(value: unknown): string { return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
function canonicalCandidateKey(candidate: ScholarshipCandidate): string { return `${normalizeText(candidate.title)}::${normalizeText(candidate.provider)}`; }
function hostOf(value: string): string | undefined { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return undefined; } }

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch { return value.trim().toLowerCase().replace(/\/$/, ""); }
}
