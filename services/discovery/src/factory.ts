import type { SearchProvider } from "@scholarship-agent/search";
import { BraveSearchProvider, PublicSearchProvider, RssSearchProvider, TavilySearchProvider } from "@scholarship-agent/search";
import { DiscoveryEngine } from "./engine";
import type { DiscoveryRecord, ScholarshipSource } from "./index";
import { RegistrySource } from "./registry-source";
import { getEnabledSourceRegistry, getSourceRegistryUrls } from "./source-registry";
import { loadDiscoveryConfig } from "./config";
import { HttpPageSource } from "./http";
import { discoverBroadly } from "./open-source-discovery";
import { crawlDiscoveryPages, type CrawlResult } from "./crawler";

export function createDiscoveryEngine(): DiscoveryEngine {
  const config = loadDiscoveryConfig();
  const sources: ScholarshipSource[] = [new RegistrySource(getEnabledSourceRegistry())];
  if (config.searxngUrl) sources.push(createSearxngSource(config.searxngUrl, config.searxngEngines, config));
  const crawlSeeds = [...getSourceRegistryUrls(), ...config.directUrls];
  if (crawlSeeds.length) sources.push(createCrawleeSource(crawlSeeds, config));
  else if (config.directUrls.length) sources.push(new HttpPageSource({ name: "configured-direct-pages", urls: config.directUrls, runOnce: true }));
  if (config.rssFeeds.length) sources.push(adaptSearchProvider(new RssSearchProvider(config.rssFeeds), "rss", false));
  if (config.searchEndpoint) sources.push(adaptSearchProvider(new PublicSearchProvider(config.searchEndpoint, config.searchApiKey), "public-search"));
  if (config.tavilyApiKey) sources.push(adaptSearchProvider(new TavilySearchProvider(config.tavilyApiKey), "tavily"));
  if (config.braveSearchApiKey) sources.push(adaptSearchProvider(new BraveSearchProvider(config.braveSearchApiKey), "brave"));
  return new DiscoveryEngine(sources);
}

function createSearxngSource(baseUrl: string, engines: string[] | undefined, config: ReturnType<typeof loadDiscoveryConfig>): ScholarshipSource {
  let lastCrawl: CrawlResult | undefined;
  let remainingPages = config.maxPages;
  const crawled = new Set<string>();
  return {
    name: "searxng",
    runOnce: false,
    async search(query: string): Promise<DiscoveryRecord[]> {
      const hits = await discoverBroadly([query], { searxngUrl: baseUrl, engines, maxResults: 100, timeoutMs: config.requestTimeoutMs });
      const searchRecords: DiscoveryRecord[] = hits.map(hit => ({ url: hit.url, originalUrl: hit.url, title: hit.title, snippet: hit.snippet, source: "searxng", sourceEngine: hit.engine, discoveryMethod: "searxng", query, discoveryState: "discovered" }));
      if (!remainingPages) return searchRecords;
      const seedUrls = hits.map(hit => hit.url).filter(url => { if (crawled.has(url)) return false; crawled.add(url); return true; }).slice(0, Math.min(12, remainingPages));
      if (!seedUrls.length) return searchRecords;
      lastCrawl = await crawlDiscoveryPages(seedUrls, query, {
        maxPages: Math.min(remainingPages, 24),
        maxDepth: Math.min(config.maxDepth, 2),
        concurrency: config.concurrency,
        requestTimeoutMs: config.requestTimeoutMs,
        playwrightEnabled: config.playwrightEnabled
      });
      remainingPages = Math.max(0, remainingPages - lastCrawl.pagesVisited);
      const crawledRecords = lastCrawl.records.map(record => ({ ...record, source: "searxng-crawled", discoveryMethod: record.discoveryMethod === "playwright-fallback" ? record.discoveryMethod : "searxng-crawlee", discoveryState: "extracted" as const }));
      return [...searchRecords, ...crawledRecords];
    },
    diagnostics: () => lastCrawl ? { pagesVisited: lastCrawl.pagesVisited, failures: lastCrawl.failures } : undefined,
    async healthCheck(): Promise<boolean> {
      try { await discoverBroadly(["fully funded scholarship forestry"], { searxngUrl: baseUrl, engines, maxResults: 1, timeoutMs: 10_000 }); return true; }
      catch { return false; }
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
