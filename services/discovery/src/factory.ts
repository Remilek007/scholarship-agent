import { PublicSearchProvider, RssSearchProvider } from "@scholarship-agent/search";
import { DiscoveryEngine, type ScholarshipSource } from "./index";
import { loadDiscoveryConfig } from "./config";
import { HttpPageSource } from "./http";

export function createDiscoveryEngine(): DiscoveryEngine {
  const config = loadDiscoveryConfig();
  const sources: ScholarshipSource[] = [];

  if (config.directUrls.length) {
    sources.push(new HttpPageSource({ name: "configured-direct-pages", urls: config.directUrls }));
  }
  if (config.rssFeeds.length) {
    sources.push(new RssSearchProvider(config.rssFeeds) as unknown as ScholarshipSource);
  }
  if (config.searchEndpoint) {
    sources.push(new PublicSearchProvider(config.searchEndpoint, config.searchApiKey) as unknown as ScholarshipSource);
  }

  return new DiscoveryEngine(sources);
}
