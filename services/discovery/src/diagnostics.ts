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
  providerErrors: Array<{ source: string; query: string; error: string }>;
  sourceHealth: Array<{ name: string; healthy: boolean }>;
  sourceResults: Array<{ name: string; records: number; errors: number }>;
}
