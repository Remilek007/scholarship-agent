import { buildDiscoveryQueries } from "@scholarship-agent/search";
import type { ApplicantProfile } from "@scholarship-agent/shared";
import { persistDiscoveryRecords, persistEnrichedDiscoveryRecords } from "./persistence";
import { enrichDiscoveryRecords } from "./enrich";
import type { DiscoveryDiagnostics } from "./diagnostics";

export interface DiscoveryRecord { url: string; title?: string; snippet?: string; source: string; discoveryMethod: string; query: string; }
export interface ScholarshipSource { readonly name: string; readonly runOnce?: boolean; search(query: string): Promise<DiscoveryRecord[]>; healthCheck(): Promise<boolean>; }

export class DiscoveryEngine {
  constructor(private readonly sources: ScholarshipSource[]) {}
  async plan(profile: ApplicantProfile): Promise<string[]> { return buildDiscoveryQueries(profile); }

  async search(profile: ApplicantProfile, queries = buildDiscoveryQueries(profile)): Promise<DiscoveryRecord[]> {
    const result = await this.searchWithDiagnostics(profile, queries);
    return result.records;
  }

  async searchWithDiagnostics(_profile: ApplicantProfile, queries = buildDiscoveryQueries(_profile)): Promise<{ records: DiscoveryRecord[]; diagnostics: DiscoveryDiagnostics }> {
    const records: DiscoveryRecord[] = [];
    const providerErrors: DiscoveryDiagnostics["providerErrors"] = [];
    const onceSources = this.sources.filter(source => source.runOnce);
    const querySources = this.sources.filter(source => !source.runOnce);

    const onceResults = await Promise.allSettled(onceSources.map(source => source.search("registry discovery")));
    onceResults.forEach((result, index) => {
      if (result.status === "fulfilled") records.push(...result.value);
      else providerErrors.push({ source: onceSources[index].name, query: "registry discovery", error: errorMessage(result.reason) });
    });

    for (const query of queries) {
      const results = await Promise.allSettled(querySources.map(source => source.search(query)));
      results.forEach((result, index) => {
        if (result.status === "fulfilled") records.push(...result.value);
        else providerErrors.push({ source: querySources[index].name, query, error: errorMessage(result.reason) });
      });
    }

    const uniqueRecords = deduplicateRecords(records);
    const health = await this.health();
    const diagnostics: DiscoveryDiagnostics = {
      queries: queries.length,
      sourcesConfigured: this.sources.length,
      sourcesHealthy: health.filter(item => item.healthy).length,
      registrySources: onceSources.length,
      providerSources: querySources.length,
      rawRecords: records.length,
      uniqueRecords: uniqueRecords.length,
      selectedForEnrichment: 0,
      enriched: 0,
      verified: 0,
      enrichmentErrors: 0,
      providerErrors,
      sourceHealth: health
    };
    return { records: rankDiscoveryRecords(uniqueRecords), diagnostics };
  }

  async searchAndPersist(profile: ApplicantProfile, options: { deepEnrich?: boolean; limit?: number } = {}) {
    const searched = await this.searchWithDiagnostics(profile);
    const records = searched.records;
    if (options.deepEnrich === false) {
      const persistence = await persistDiscoveryRecords(records);
      return { records, persistence, enriched: 0, verified: 0, diagnostics: { ...searched.diagnostics, selectedForEnrichment: 0, enriched: 0, verified: 0, enrichmentErrors: 0 } };
    }
    const enrichmentLimit = Math.max(1, Math.min(options.limit ?? 40, 100));
    const enriched = await enrichDiscoveryRecords(profile, records, enrichmentLimit);
    const persistence = await persistEnrichedDiscoveryRecords(enriched);
    return {
      records,
      enriched: enriched.map(item => item.candidate),
      enrichmentErrors: enriched.filter(item => item.enrichmentError).map(item => ({ url: item.record.url, error: item.enrichmentError })),
      persistence,
      verified: persistence.verified,
      diagnostics: {
        ...searched.diagnostics,
        selectedForEnrichment: Math.min(records.length, enrichmentLimit),
        enriched: enriched.length,
        verified: persistence.verified,
        enrichmentErrors: enriched.filter(item => item.enrichmentError).length
      }
    };
  }

  async persist(records: DiscoveryRecord[]) { return persistDiscoveryRecords(records); }
  async health() { return Promise.all(this.sources.map(async source => ({ name: source.name, healthy: await source.healthCheck() }))); }
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error ?? "Unknown error"); }
function rankDiscoveryRecords(records: DiscoveryRecord[]): DiscoveryRecord[] { return records.map((record,index)=>({record,index,score:discoveryScore(record)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(item=>item.record); }
function discoveryScore(record: DiscoveryRecord): number { const value=`${record.title??""} ${record.snippet??""} ${record.url}`.toLowerCase(); let score=0; if(/forestry|forest|wildlife|conservation|biodiversity|natural resource|climate|remote sensing|gis/.test(value))score+=10; if(/funded|full scholarship|stipend|studentship|assistantship|fellowship/.test(value))score+=8; if(/msc|m\.sc|master/.test(value))score+=7; if(/research position|research project|graduate research|funded thesis/.test(value))score+=8; if(/nigeria|international students|all nationalities/.test(value))score+=3; return score; }
function deduplicateRecords(records: DiscoveryRecord[]): DiscoveryRecord[] { const seen=new Set<string>(); return records.filter(record=>{const key=canonicalizeUrl(record.url);if(seen.has(key))return false;seen.add(key);return true;}); }
function canonicalizeUrl(input:string):string { try { const url=new URL(input); url.hash=""; url.search=""; url.hostname=url.hostname.toLowerCase(); return url.toString().replace(/\/$/,""); } catch { return input.trim().toLowerCase(); } }

export { createDiscoveryEngine } from "./factory";
export { HttpPageSource } from "./http";
export { RegistrySource } from "./registry-source";
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
export { assessOpportunityQuality, deduplicateCandidates } from "./quality";
export type { QualityAssessment } from "./quality";
export type { DiscoveryDiagnostics } from "./diagnostics";
