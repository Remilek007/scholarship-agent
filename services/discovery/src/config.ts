export interface DiscoveryConfig {
  directUrls: string[];
  rssFeeds: string[];
  searchEndpoint?: string;
  searchApiKey?: string;
  braveSearchApiKey?: string;
  tavilyApiKey?: string;
  searxngUrl?: string;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  playwrightEnabled: boolean;
}

function list(value?: string): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function numberValue(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function loadDiscoveryConfig(env: NodeJS.ProcessEnv = process.env): DiscoveryConfig {
  return {
    directUrls: list(env.DISCOVERY_DIRECT_URLS),
    rssFeeds: list(env.DISCOVERY_RSS_FEEDS),
    searchEndpoint: env.DISCOVERY_SEARCH_ENDPOINT?.trim() || undefined,
    searchApiKey: env.DISCOVERY_SEARCH_API_KEY?.trim() || undefined,
    braveSearchApiKey: env.BRAVE_SEARCH_API_KEY?.trim() || undefined,
    tavilyApiKey: env.TAVILY_API_KEY?.trim() || undefined,
    searxngUrl: env.SEARXNG_URL?.trim().replace(/\/$/, "") || undefined,
    maxPages: numberValue(env.DISCOVERY_MAX_PAGES, 250, 1),
    maxDepth: numberValue(env.DISCOVERY_MAX_DEPTH, 2, 0),
    concurrency: numberValue(env.DISCOVERY_CONCURRENCY, 6, 1),
    playwrightEnabled: booleanValue(env.DISCOVERY_PLAYWRIGHT_ENABLED, false)
  };
}
