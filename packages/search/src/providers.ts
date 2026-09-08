import type { SearchProvider, SearchResult } from "./sources";

export class RssSearchProvider implements SearchProvider {
  readonly name = "rss";
  constructor(private readonly feeds: string[]) {}
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    let failures = 0;
    for (const feed of this.feeds) {
      try {
        const response = await fetch(feed, { headers: { "user-agent": "ScholarshipAgent/0.1" }, signal: AbortSignal.timeout(10_000) });
        if (!response.ok) { failures += 1; continue; }
        results.push(...parseFeed(await response.text(), query, feed));
      } catch { failures += 1; }
    }
    if (this.feeds.length > 0 && failures === this.feeds.length) throw new Error(`All RSS feeds failed (${this.feeds.length})`);
    return results;
  }
}

export class PublicSearchProvider implements SearchProvider {
  readonly name = "public-search";
  constructor(private readonly endpoint: string, private readonly apiKey?: string) {}
  async search(query: string): Promise<SearchResult[]> {
    if (!this.endpoint) return [];
    const url = new URL(this.endpoint);
    url.searchParams.set("q", query);
    const headers: Record<string, string> = { "user-agent": "ScholarshipAgent/0.1" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Public search returned HTTP ${response.status}`);
    const data = await response.json() as { results?: Array<{ url?: string; title?: string; snippet?: string }> };
    return (data.results ?? []).filter(item => item.url && item.title).map(item => ({ url: item.url!, title: item.title!, snippet: item.snippet, source: this.name }));
  }
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = "tavily";
  constructor(private readonly apiKey: string) {}
  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) return [];
    const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}`, "user-agent": "ScholarshipAgent/0.1" }, body: JSON.stringify({ query, search_depth: "basic", max_results: 10, include_answer: false, include_raw_content: false }), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Tavily returned HTTP ${response.status}`);
    const data = await response.json() as { results?: Array<{ url?: string; title?: string; content?: string }> };
    return (data.results ?? []).filter(item => item.url && item.title).map(item => ({ url: item.url!, title: item.title!, snippet: item.content, source: this.name }));
  }
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave";
  constructor(private readonly apiKey: string) {}
  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) return [];
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query); url.searchParams.set("count", "20"); url.searchParams.set("search_lang", "en");
    const response = await fetch(url, { headers: { accept: "application/json", "x-subscription-token": this.apiKey, "user-agent": "ScholarshipAgent/0.1" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Brave returned HTTP ${response.status}`);
    const data = await response.json() as { web?: { results?: Array<{ url?: string; title?: string; description?: string }> } };
    return (data.web?.results ?? []).filter(item => item.url && item.title).map(item => ({ url: item.url!, title: item.title!, snippet: item.description, source: this.name }));
  }
}

function parseFeed(xml: string, query: string, source: string): SearchResult[] {
  const entries = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi)];
  return entries.flatMap(match => {
    const block = match[0];
    const title = textFromTag(block, "title");
    const link = textFromTag(block, "link") ?? block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    const description = textFromTag(block, "description") ?? textFromTag(block, "summary") ?? textFromTag(block, "content");
    if (!title || !link) return [];
    const haystack = `${title} ${description ?? ""}`.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);
    if (terms.length && !terms.some(term => haystack.includes(term.replace(/["']/g, "")))) return [];
    return [{ url: decodeXml(link), title: clean(decodeXml(title)), snippet: clean(decodeXml(description ?? "")), source }];
  });
}
function textFromTag(block: string, tag: string): string | undefined { return block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1]; }
function decodeXml(value: string): string { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
function clean(value: string): string { return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
