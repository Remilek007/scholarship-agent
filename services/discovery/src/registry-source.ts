import type { DiscoveryRecord, ScholarshipSource } from "./index";
import type { DiscoverySourceDefinition } from "./source-registry";
import { loadDiscoveryConfig } from "./config";

const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const SITEMAP_LOC_PATTERN = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;
const USEFUL_TERMS = /(scholarship|funding|fellowship|studentship|assistantship|research|graduate|master|msc|application|admission|bursary|stipend|tuition|financial[- ]aid|award|students)/i;
const OPPORTUNITY_TERMS = /(scholarship|funding|fellowship|studentship|assistantship|research[- ]?(position|project|opportunity)|graduate|master|msc|application|admission|bursary|stipend|tuition|financial[- ]aid|award|studentship)/i;
const MAX_RECORDS = 300;
const MAX_SITEMAP_URLS = 80;
const SOURCE_CONCURRENCY = 5;

export class RegistrySource implements ScholarshipSource {
  readonly name = "source-registry";
  readonly runOnce = true;
  private readonly definitions: DiscoverySourceDefinition[];
  constructor(definitions: DiscoverySourceDefinition[]) { this.definitions = definitions.filter(item => item.enabledByDefault && item.urls.length); }

  async search(query: string): Promise<DiscoveryRecord[]> {
    const config = loadDiscoveryConfig();
    const records: DiscoveryRecord[] = [];
    const seenUrls = new Set<string>();
    const sourcePages = Math.max(1, Math.min(config.maxPages, 80));
    for (let offset = 0; offset < this.definitions.length && records.length < MAX_RECORDS; offset += SOURCE_CONCURRENCY) {
      const batch = this.definitions.slice(offset, offset + SOURCE_CONCURRENCY);
      const results = await Promise.allSettled(batch.flatMap(definition => definition.urls.map(url => crawlSource(definition, url, query, sourcePages, config.maxDepth))));
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const record of result.value) {
          const key = canonicalizeUrl(record.url);
          if (seenUrls.has(key)) continue;
          seenUrls.add(key);
          records.push(record);
          if (records.length >= MAX_RECORDS) return records;
        }
      }
    }
    return records;
  }

  async healthCheck(): Promise<boolean> {
    const checks = await Promise.all(this.definitions.slice(0, 12).flatMap(definition => definition.urls.map(asyncCheck)));
    return checks.some(Boolean);
  }
}

async function asyncCheck(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { "user-agent": "ScholarshipAgent/0.3 (+opportunity-discovery)" }, redirect: "follow", signal: AbortSignal.timeout(8_000) });
    return response.ok;
  } catch { return false; }
}

async function crawlSource(definition: DiscoverySourceDefinition, seedUrl: string, query: string, maxPages: number, maxDepth: number): Promise<DiscoveryRecord[]> {
  const records: DiscoveryRecord[] = [];
  const visited = new Set<string>();
  const queued = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: seedUrl, depth: 0 }];
  queued.add(canonicalizeUrl(seedUrl));
  const seed = new URL(seedUrl);
  const queryTerms = query.toLowerCase().split(/\s+/).map(term => term.replace(/[^a-z0-9-]/g, "")).filter(term => term.length > 3);
  queue.push(...(await discoverSitemapUrls(seedUrl, seed.hostname)).slice(0, Math.min(maxPages, 40)).map(url => ({ url, depth: 1 })));

  while (queue.length && visited.size < maxPages && records.length < MAX_RECORDS) {
    const current = queue.shift()!;
    const canonical = canonicalizeUrl(current.url);
    if (visited.has(canonical)) continue;
    visited.add(canonical);
    const page = await fetchPage(current.url);
    if (!page) continue;

    const title = extractTitle(page.html) ?? definition.name;
    const text = visibleText(page.html);
    const value = `${title} ${text.slice(0, 16000)} ${page.url}`.toLowerCase();
    const queryMatches = queryTerms.length === 0 || queryTerms.filter(term => value.includes(term)).length >= Math.min(2, queryTerms.length);
    if ((USEFUL_TERMS.test(value) || OPPORTUNITY_TERMS.test(page.url)) && queryMatches) {
      records.push({ url: page.url, originalUrl: current.url, title, snippet: `${definition.name}: ${text.slice(0, 2200)}`, source: definition.name, discoveryMethod: "registry_crawl", query });
    }

    if (current.depth >= maxDepth) continue;
    for (const match of page.html.matchAll(LINK_PATTERN)) {
      if (visited.size + queue.length >= maxPages * 2) break;
      const href = match[1]?.trim();
      const label = clean(match[2]) ?? "";
      if (!href) continue;
      let absolute: URL;
      try { absolute = new URL(href, page.url); } catch { continue; }
      if (absolute.protocol !== "https:" || absolute.hostname.toLowerCase() !== seed.hostname.toLowerCase()) continue;
      absolute.hash = "";
      const url = absolute.toString();
      const key = canonicalizeUrl(url);
      if (visited.has(key) || queued.has(key) || !OPPORTUNITY_TERMS.test(`${label} ${url}`)) continue;
      queued.add(key);
      queue.push({ url, depth: current.depth + 1 });
    }
  }
  return records;
}

async function discoverSitemapUrls(seedUrl: string, hostname: string): Promise<string[]> {
  const origin = new URL(seedUrl).origin;
  const urls: string[] = [];
  for (const sitemap of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]) {
    try {
      const response = await fetch(sitemap, { headers: { "user-agent": "ScholarshipAgent/0.3 (+opportunity-discovery)" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) continue;
      const xml = await response.text();
      for (const match of xml.matchAll(SITEMAP_LOC_PATTERN)) {
        const value = decodeEntities(clean(match[1]) ?? "");
        try {
          const url = new URL(value);
          if (url.protocol !== "https:" || url.hostname.toLowerCase() !== hostname.toLowerCase() || !OPPORTUNITY_TERMS.test(url.pathname)) continue;
          urls.push(url.toString());
          if (urls.length >= MAX_SITEMAP_URLS) return [...new Set(urls.map(canonicalizeUrl))];
        } catch { /* ignore malformed sitemap entries */ }
      }
    } catch { /* sitemap is optional */ }
  }
  return [...new Set(urls.map(canonicalizeUrl))];
}

async function fetchPage(url: string): Promise<{ url: string; html: string } | undefined> {
  try {
    const response = await fetch(url, { headers: { "user-agent": "ScholarshipAgent/0.3 (+opportunity-discovery)", accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(loadDiscoveryConfig().requestTimeoutMs) });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return undefined;
    return { url: response.url || url, html: (await response.text()).slice(0, 600_000) };
  } catch { return undefined; }
}

function extractTitle(html: string): string | undefined { return clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]); }
function visibleText(html: string): string { return clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ")) ?? ""; }
function decodeEntities(value: string): string { return value.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code))).replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"); }
function clean(value: string | undefined): string | undefined { if (!value) return undefined; return decodeEntities(value).replace(/\s+/g, " ").trim() || undefined; }
function canonicalizeUrl(input: string): string { try { const url = new URL(input); url.hash = ""; url.hostname = url.hostname.toLowerCase(); for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) url.searchParams.delete(key); return url.toString().replace(/\/$/, ""); } catch { return input.trim().toLowerCase(); } }
