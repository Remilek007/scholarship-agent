import type { DiscoveryRecord, ScholarshipSource } from "./index";
import type { DiscoverySourceDefinition } from "./source-registry";

const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const SITEMAP_LOC_PATTERN = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;
const USEFUL_TERMS = /(scholarship|funding|fellowship|studentship|assistantship|research|graduate|master|msc|application|admission|bursary|stipend|tuition|financial[- ]aid|award|students)/i;
const OPPORTUNITY_TERMS = /(scholarship|funding|fellowship|studentship|assistantship|research[- ]?(position|project|opportunity)|graduate|master|msc|application|admission|bursary|stipend|tuition|financial[- ]aid|award|studentship)/i;
const MAX_RECORDS = 250;
const MAX_PAGES_PER_SOURCE = 20;
const MAX_SITEMAP_URLS = 80;

export class RegistrySource implements ScholarshipSource {
  readonly name = "source-registry";
  readonly runOnce = true;
  private readonly definitions: DiscoverySourceDefinition[];

  constructor(definitions: DiscoverySourceDefinition[]) {
    this.definitions = definitions.filter((item) => item.enabledByDefault && item.urls.length);
  }

  async search(query: string): Promise<DiscoveryRecord[]> {
    const records: DiscoveryRecord[] = [];
    const seenUrls = new Set<string>();
    for (const definition of this.definitions) {
      for (const seedUrl of definition.urls) {
        if (records.length >= MAX_RECORDS) return records;
        const sourceRecords = await crawlSource(definition, seedUrl, query);
        for (const record of sourceRecords) {
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
    for (const definition of this.definitions) {
      for (const url of definition.urls) {
        try {
          const response = await fetch(url, { method: "GET", headers: { "user-agent": "ScholarshipAgent/0.1 (+opportunity-discovery)" }, signal: AbortSignal.timeout(8_000) });
          if (response.ok) return true;
        } catch { /* try next source */ }
      }
    }
    return false;
  }
}

async function crawlSource(definition: DiscoverySourceDefinition, seedUrl: string, query: string): Promise<DiscoveryRecord[]> {
  const records: DiscoveryRecord[] = [];
  const visited = new Set<string>();
  const queue: string[] = [seedUrl];
  const seed = new URL(seedUrl);
  const sitemapUrls = await discoverSitemapUrls(seedUrl, seed.hostname);
  for (const sitemapUrl of sitemapUrls) {
    if (queue.length >= MAX_PAGES_PER_SOURCE * 3) break;
    queue.push(sitemapUrl);
  }

  while (queue.length && visited.size < MAX_PAGES_PER_SOURCE && records.length < MAX_RECORDS) {
    const current = queue.shift()!;
    const canonical = canonicalizeUrl(current);
    if (visited.has(canonical)) continue;
    visited.add(canonical);
    const page = await fetchPage(current);
    if (!page) continue;
    const title = extractTitle(page.html) ?? definition.name;
    const text = visibleText(page.html);
    const value = `${title} ${text.slice(0, 12000)} ${page.url}`;
    if (USEFUL_TERMS.test(value) || OPPORTUNITY_TERMS.test(page.url)) {
      records.push({ url: page.url, title, snippet: `${definition.name}: ${text.slice(0, 1800)}`, source: definition.name, discoveryMethod: "registry_crawl", query });
    }
    for (const match of page.html.matchAll(LINK_PATTERN)) {
      if (visited.size + queue.length >= MAX_PAGES_PER_SOURCE * 2) break;
      const href = match[1]?.trim();
      const label = clean(match[2]) ?? "";
      if (!href) continue;
      let absolute: URL;
      try { absolute = new URL(href, page.url); } catch { continue; }
      if (absolute.protocol !== "https:" || absolute.hostname !== seed.hostname) continue;
      absolute.hash = "";
      const url = absolute.toString();
      if (visited.has(canonicalizeUrl(url))) continue;
      if (!OPPORTUNITY_TERMS.test(`${label} ${url}`)) continue;
      queue.push(url);
    }
  }
  return records;
}

async function discoverSitemapUrls(seedUrl: string, hostname: string): Promise<string[]> {
  const origin = new URL(seedUrl).origin;
  const urls: string[] = [];
  for (const sitemap of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]) {
    try {
      const response = await fetch(sitemap, { headers: { "user-agent": "ScholarshipAgent/0.1 (+opportunity-discovery)" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) continue;
      const xml = await response.text();
      for (const match of xml.matchAll(SITEMAP_LOC_PATTERN)) {
        const value = decodeEntities(clean(match[1]) ?? "");
        try {
          const url = new URL(value);
          if (url.protocol !== "https:" || url.hostname !== hostname || !OPPORTUNITY_TERMS.test(url.pathname)) continue;
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
    const response = await fetch(url, { headers: { "user-agent": "ScholarshipAgent/0.1 (+opportunity-discovery)", accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return undefined;
    return { url: response.url || url, html: (await response.text()).slice(0, 600_000) };
  } catch { return undefined; }
}

function extractTitle(html: string): string | undefined { return clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]); }
function visibleText(html: string): string { return clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ")) ?? ""; }
function decodeEntities(value: string): string { return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"); }
function clean(value: string | undefined): string | undefined { if (!value) return undefined; return decodeEntities(value).replace(/\s+/g, " ").trim() || undefined; }
function canonicalizeUrl(input: string): string { try { const url = new URL(input); url.hash = ""; url.search = ""; url.hostname = url.hostname.toLowerCase(); return url.toString().replace(/\/$/, ""); } catch { return input.trim().toLowerCase(); } }
