export interface DiscoveryDiagnostics {
  queries: number;
  sourcesConfigured: number;
  sourcesHealthy: number;
  registrySources: number;
  providerSources: number;
  rawRecords: number;
  uniqueRecords: number;
  selectedForEnrichment: number;
  enriched: number;
  verified: number;
  enrichmentErrors: number;
  discovered: number;
  extracted: number;
  eligible: number;
  reviewNeeded: number;
  crawlPagesVisited: number;
  crawlFailures: number;
  providerErrors: Array<{ source: string; query: string; error: string }>;
  sourceHealth: Array<{ name: string; healthy: boolean }>;
  sourceResults: Array<{ name: string; records: number; errors: number }>;
  crawlErrors: Array<{ source: string; url: string; stage: string; error: string }>;
}
