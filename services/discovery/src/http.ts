import type { DiscoveryRecord, ScholarshipSource } from "./index";

export class HttpPageSource implements ScholarshipSource {
  readonly name: string;
  constructor(private readonly config: { name: string; urls: string[] }) { this.name = config.name; }

  async search(query: string): Promise<DiscoveryRecord[]> {
    const records: DiscoveryRecord[] = [];
    for (const url of this.config.urls) {
      try {
        const response = await fetch(url, { headers: { "user-agent": "ScholarshipAgent/0.1" } });
        if (!response.ok) continue;
        const html = await response.text();
        records.push({ url, title: extractTitle(html), source: this.name, discoveryMethod: "direct_page", query });
      } catch { /* keep other sources running */ }
    }
    return records;
  }

  async healthCheck(): Promise<boolean> {
    try { return (await fetch(this.config.urls[0], { method: "HEAD" })).ok; }
    catch { return false; }
  }
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
