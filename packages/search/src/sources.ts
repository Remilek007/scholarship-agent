export interface SearchResult {
  url: string;
  title: string;
  snippet?: string;
  source: string;
}

/**
 * Provider-neutral contract. Concrete adapters can use a free API, RSS,
 * sitemap, or compliant web-search integration without changing the pipeline.
 */
export interface SearchProvider {
  readonly name: string;
  search(query: string): Promise<SearchResult[]>;
}

export function uniqueSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    try {
      const url = new URL(result.url);
      url.hash = "";
      url.search = "";
      const key = url.toString().replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}
