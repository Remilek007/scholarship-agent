export interface DiscoveryRecord {
  url: string;
  sourceUrl?: string;
  title?: string;
  snippet?: string;
  source: string;
  discoveryMethod: string;
  query?: string;
  originalUrl?: string;
  sourceEngine?: string;
}

export interface ScholarshipSource {
  readonly name: string;
  readonly runOnce?: boolean;
  search(query: string): Promise<DiscoveryRecord[]>;
  healthCheck?(): Promise<boolean>;
}

export { DiscoveryEngine } from "./engine";
export * from "./discovery-enhancements";
export * from "./open-source-discovery";
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
export { enrichDiscoveryRecords, expandExtraction } from "./enrich";
export type { EnrichedDiscoveryRecord } from "./enrich";
export { SOURCE_REGISTRY, getEnabledSourceRegistry, getSourceRegistryUrls } from "./source-registry";
export type { DiscoverySourceDefinition } from "./source-registry";
export { assessOpportunityQuality, deduplicateCandidates } from "./quality";
export type { QualityAssessment } from "./quality";
export { createDiscoveryScheduler, readScheduledProfile } from "./scheduler";
export type { DiscoverySchedulerStatus } from "./scheduler";
export type { DiscoveryDiagnostics } from "./diagnostics";
