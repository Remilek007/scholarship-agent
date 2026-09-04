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
        records.push({
          url,
          title: extractTitle(html),
          snippet: extractDescription(html) ?? extractVisibleText(html).slice(0, 2000),
          source: this.name,
          discoveryMethod: "direct_page",
          query
        });
      } catch { /* keep other sources running */ }
    }
    return records;
  }

  async healthCheck(): Promise<boolean> {
    try { return (await fetch(this.config.urls[0], { method: "HEAD", signal: AbortSignal.timeout(10_000) })).ok; }
    catch { return false; }
  }
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return clean(match?.[1]);
}

function extractDescription(html: string): string | undefined {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  return clean(match?.[1]);
}

function extractVisibleText(html: string): string {
  return clean(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")) ?? "";
}

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\s+/g, " ").trim() || undefined;
}
