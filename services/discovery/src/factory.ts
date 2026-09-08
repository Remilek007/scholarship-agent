import type { SearchProvider } from "@scholarship-agent/search";
import { BraveSearchProvider, PublicSearchProvider, RssSearchProvider, TavilySearchProvider } from "@scholarship-agent/search";
import { DiscoveryEngine, type DiscoveryRecord, type ScholarshipSource, RegistrySource, getEnabledSourceRegistry } from "./index";
import { loadDiscoveryConfig } from "./config";
import { HttpPageSource } from "./http";

export function createDiscoveryEngine(): DiscoveryEngine {
  const config = loadDiscoveryConfig();
  const sources: ScholarshipSource[] = [new RegistrySource(getEnabledSourceRegistry())];
  if (config.directUrls.length) sources.push(new HttpPageSource({ name: "configured-direct-pages", urls: config.directUrls, runOnce: true }));
  if (config.rssFeeds.length) sources.push(adaptSearchProvider(new RssSearchProvider(config.rssFeeds), "rss", true));
  if (config.searchEndpoint) sources.push(adaptSearchProvider(new PublicSearchProvider(config.searchEndpoint, config.searchApiKey), "public-search"));
  if (config.tavilyApiKey) sources.push(adaptSearchProvider(new TavilySearchProvider(config.tavilyApiKey), "tavily"));
  if (config.braveSearchApiKey) sources.push(adaptSearchProvider(new BraveSearchProvider(config.braveSearchApiKey), "brave"));
  return new DiscoveryEngine(sources);
}

function adaptSearchProvider(provider: SearchProvider, method: string, runOnce = false): ScholarshipSource {
  return {
    name: provider.name,
    runOnce,
    async search(query: string): Promise<DiscoveryRecord[]> {
      const results = await provider.search(query);
      return results.map(result => ({ url: result.url, title: result.title, snippet: result.snippet, source: result.source, discoveryMethod: method, query }));
    },
    async healthCheck(): Promise<boolean> { try { await provider.search("funded master's forestry"); return true; } catch { return false; } }
  };
}
