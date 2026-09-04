import type { DiscoveryRecord, ScholarshipSource } from "./index";

export class HttpPageSource implements ScholarshipSource {
  readonly name: string;
  constructor(private readonly config: { name: string; urls: string[] }) { this.name = config.name; }

  async search(query: string): Promise<DiscoveryRecord[]> {
    const records: DiscoveryRecord[] = [];
    for (const url of this.config.urls) {
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "ScholarshipAgent/0.1" },
          signal: AbortSignal.timeout(15_000)
        });
        if (!response.ok) continue;
        const html = await response.text();
        const canonical = extractCanonical(html) ?? response.url ?? url;
        const description = extractDescription(html);
        const visibleText = extractVisibleText(html);
        const usefulLinks = extractUsefulLinks(html, canonical);
        const structured = extractJsonLd(html);
        records.push({
          url: canonical,
          title: extractTitle(html) ?? structured.title,
          snippet: [description, structured.description, visibleText.slice(0, 1800), usefulLinks]
            .filter(Boolean).join(" ").slice(0, 4000),
          source: this.name,
          discoveryMethod: "direct_page",
          query
        });
      } catch { /* keep other sources running */ }
    }
    return records;
  }

  async healthCheck(): Promise<boolean> {
    for (const url of this.config.urls) {
      try {
        const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
        if (response.ok) return true;
      } catch { /* try next URL */ }
    }
    return false;
  }
}

function extractTitle(html: string): string | undefined {
  return clean(decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]));
}

function extractDescription(html: string): string | undefined {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i
  ];
  for (const pattern of patterns) {
    const value = clean(decodeHtml(html.match(pattern)?.[1]));
    if (value) return value;
  }
  return undefined;
}

function extractCanonical(html: string): string | undefined {
  const match = html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/i);
  return clean(match?.[1]);
}

function extractUsefulLinks(html: string, baseUrl: string): string | undefined {
  const links: string[] = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const label = clean(decodeHtml(match[2])) ?? "";
    if (!href || !label) continue;
    if (!/(apply|application|admission|funding|scholarship|fellowship|studentship|deadline|eligib)/i.test(`${label} ${href}`)) continue;
    try { links.push(`${label}: ${new URL(href, baseUrl).toString()}`); } catch { /* ignore */ }
    if (links.length >= 12) break;
  }
  return links.length ? `Useful links: ${links.join(" | ")}` : undefined;
}

function extractJsonLd(html: string): { title?: string; description?: string } {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]) as Record<string, unknown> | Array<Record<string, unknown>>;
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...((parsed["@graph"] as Array<Record<string, unknown>>) ?? [])];
      for (const item of candidates) {
        if (item && (item.name || item.description)) return {
          title: typeof item.name === "string" ? clean(item.name) : undefined,
          description: typeof item.description === "string" ? clean(item.description) : undefined
        };
      }
    } catch { /* invalid JSON-LD is non-fatal */ }
  }
  return {};
}

function extractVisibleText(html: string): string {
  return clean(decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " "))) ?? "";
}

function decodeHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\s+/g, " ").trim() || undefined;
}
