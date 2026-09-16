import type { SearchProvider } from "@scholarship-agent/search";
import { BraveSearchProvider, PublicSearchProvider, RssSearchProvider, TavilySearchProvider } from "@scholarship-agent/search";
import { DiscoveryEngine, type DiscoveryRecord, type ScholarshipSource, RegistrySource, getEnabledSourceRegistry, getSourceRegistryUrls } from "./index";
import { loadDiscoveryConfig } from "./config";
import { HttpPageSource } from "./http";
import { discoverBroadly } from "./open-source-discovery";
import { crawlDiscoveryPages, type CrawlResult } from "./crawler";

export function createDiscoveryEngine(): DiscoveryEngine {
  const config = loadDiscoveryConfig();
  const sources: ScholarshipSource[] = [new RegistrySource(getEnabledSourceRegistry())];
  if (config.searxngUrl) sources.push(createSearxngSource(config.searxngUrl, config.searxngEngines));
  const crawlSeeds = [...getSourceRegistryUrls(), ...config.directUrls];
  if (crawlSeeds.length) sources.push(createCrawleeSource(crawlSeeds, config));
  else if (config.directUrls.length) sources.push(new HttpPageSource({ name: "configured-direct-pages", urls: config.directUrls, runOnce: true }));
  if (config.rssFeeds.length) sources.push(adaptSearchProvider(new RssSearchProvider(config.rssFeeds), "rss", false));
  if (config.searchEndpoint) sources.push(adaptSearchProvider(new PublicSearchProvider(config.searchEndpoint, config.searchApiKey), "public-search"));
  if (config.tavilyApiKey) sources.push(adaptSearchProvider(new TavilySearchProvider(config.tavilyApiKey), "tavily"));
  if (config.braveSearchApiKey) sources.push(adaptSearchProvider(new BraveSearchProvider(config.braveSearchApiKey), "brave"));
  return new DiscoveryEngine(sources);
}

function createSearxngSource(baseUrl: string, engines?: string[]): ScholarshipSource {
  return {
    name: "searxng",
    runOnce: false,
    async search(query: string): Promise<DiscoveryRecord[]> {
      const hits = await discoverBroadly([query], { searxngUrl: baseUrl, engines, maxResults: 100, timeoutMs: 20_000 });
      return hits.map(hit => ({ url: hit.url, originalUrl: hit.url, title: hit.title, snippet: hit.snippet, source: "searxng", sourceEngine: hit.engine, discoveryMethod: "searxng", query, discoveryState: "discovered" }));
    },
    async healthCheck(): Promise<boolean> {
      try {
        await discoverBroadly(["fully funded scholarship forestry"], { searxngUrl: baseUrl, engines, maxResults: 1, timeoutMs: 10_000 });
        return true;
      } catch { return false; }
    }
  };
}

function createCrawleeSource(seeds: string[], config: ReturnType<typeof loadDiscoveryConfig>): ScholarshipSource {
  let last: CrawlResult | undefined;
  return {
    name: "crawlee",
    runOnce: true,
    async search(query: string): Promise<DiscoveryRecord[]> {
      last = await crawlDiscoveryPages(seeds, query, config);
      return last.records.map(record => ({ ...record, discoveryState: "extracted" }));
    },
    diagnostics: () => last ? { pagesVisited: last.pagesVisited, failures: last.failures } : undefined,
    healthCheck: async () => seeds.length > 0,
  };
}

function adaptSearchProvider(provider: SearchProvider, method: string, runOnce = false): ScholarshipSource {
  return {
    name: provider.name,
    runOnce,
    async search(query: string): Promise<DiscoveryRecord[]> {
      const results = await provider.search(query);
      return results.map(result => ({ url: result.url, originalUrl: result.url, title: result.title, snippet: result.snippet, source: result.source, discoveryMethod: method, query, discoveryState: "discovered" }));
    },
    async healthCheck(): Promise<boolean> { try { await provider.search("funded master's forestry"); return true; } catch { return false; } }
  };
}
