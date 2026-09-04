import type { SearchProvider, SearchResult } from "./sources";

export class RssSearchProvider implements SearchProvider {
  readonly name = "rss";

  constructor(private readonly feeds: string[]) {}

  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const feed of this.feeds) {
      try {
        const response = await fetch(feed, { headers: { "user-agent": "ScholarshipAgent/0.1" } });
        if (!response.ok) continue;
        const xml = await response.text();
        results.push(...parseFeed(xml, query, feed));
      } catch {
        // Continue with other feeds.
      }
    }
    return results;
  }
}

export class PublicSearchProvider implements SearchProvider {
  readonly name = "public-search";

  constructor(private readonly endpoint: string, private readonly apiKey?: string) {}

  async search(query: string): Promise<SearchResult[]> {
    if (!this.endpoint) return [];
    try {
      const url = new URL(this.endpoint);
      url.searchParams.set("q", query);
      const headers: Record<string, string> = { "user-agent": "ScholarshipAgent/0.1" };
      if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
      const response = await fetch(url, { headers });
      if (!response.ok) return [];
      const data = await response.json() as { results?: Array<{ url?: string; title?: string; snippet?: string }> };
      return (data.results ?? [])
        .filter((item) => item.url && item.title)
        .map((item) => ({ url: item.url!, title: item.title!, snippet: item.snippet, source: this.name }));
    } catch {
      return [];
    }
  }
}

function parseFeed(xml: string, query: string, source: string): SearchResult[] {
  const entries = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi)];
  return entries.flatMap((match) => {
    const block = match[0];
    const title = textFromTag(block, "title");
    const link = textFromTag(block, "link") ?? block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    const description = textFromTag(block, "description") ?? textFromTag(block, "summary") ?? textFromTag(block, "content");
    if (!title || !link) return [];
    const haystack = `${title} ${description ?? ""}`.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 3);
    if (terms.length && !terms.some((term) => haystack.includes(term.replace(/["']/g, "")))) return [];
    return [{ url: decodeXml(link), title: clean(decodeXml(title)), snippet: clean(decodeXml(description ?? "")), source }];
  });
}

function textFromTag(block: string, tag: string): string | undefined {
  return block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1];
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function clean(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
