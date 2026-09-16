import { normalizeDiscoveryRecords } from "./normalize";

export type OpenSourceDiscoveryOptions = {
  searxngUrl?: string;
  engines?: string[];
  maxResults?: number;
  timeoutMs?: number;
};

export type DiscoverySearchHit = {
  title: string;
  url: string;
  snippet?: string;
  engine?: string;
};

const DEFAULT_ENGINES = ["google", "bing", "brave", "duckduckgo"];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Discovery request timed out after ${timeoutMs}ms`)), timeoutMs))
  ]);
}

function cleanUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return value.trim();
  }
}

export async function searchWithSearXNG(query: string, options: OpenSourceDiscoveryOptions = {}): Promise<DiscoverySearchHit[]> {
  const base = options.searxngUrl ?? process.env.SEARXNG_URL;
  if (!base) return [];

  const endpoint = new URL("/search", base);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("categories", "general");
  const engines = (options.engines ?? DEFAULT_ENGINES).filter(Boolean);
  if (engines.length) endpoint.searchParams.set("engines", engines.join(","));

  const response = await withTimeout(fetch(endpoint), options.timeoutMs ?? 15_000);
  if (!response.ok) throw new Error(`SearXNG returned HTTP ${response.status}`);
  const payload = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string; engine?: string }> };

  return (payload.results ?? [])
    .filter((item) => Boolean(item.title && item.url))
    .slice(0, options.maxResults ?? 100)
    .map((item) => ({ title: item.title!, url: cleanUrl(item.url!), snippet: item.content, engine: item.engine }));
}

export async function discoverBroadly(queries: string[], options: OpenSourceDiscoveryOptions = {}): Promise<DiscoverySearchHit[]> {
  const hits = await Promise.all(queries.map((query) => searchWithSearXNG(query, options)));
  const unique = new Map<string, DiscoverySearchHit>();
  for (const hit of hits.flat()) {
    const key = cleanUrl(hit.url);
    if (!unique.has(key)) unique.set(key, hit);
  }
  return [...unique.values()];
}

export function toNormalizedDiscoveryRecords(hits: DiscoverySearchHit[]) {
  return normalizeDiscoveryRecords(hits.map((hit) => ({
    title: hit.title,
    url: hit.url,
    sourceUrl: hit.url,
    snippet: hit.snippet ?? "",
    discoveryMethod: "searxng",
    source: "searxng",
    sourceEngine: hit.engine
  })));
}
