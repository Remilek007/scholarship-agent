export interface DiscoveryConfig {
  directUrls: string[];
  rssFeeds: string[];
  searchEndpoint?: string;
  searchApiKey?: string;
}

function list(value?: string): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function loadDiscoveryConfig(env: NodeJS.ProcessEnv = process.env): DiscoveryConfig {
  return {
    directUrls: list(env.DISCOVERY_DIRECT_URLS),
    rssFeeds: list(env.DISCOVERY_RSS_FEEDS),
    searchEndpoint: env.DISCOVERY_SEARCH_ENDPOINT?.trim() || undefined,
    searchApiKey: env.DISCOVERY_SEARCH_API_KEY?.trim() || undefined
  };
}
