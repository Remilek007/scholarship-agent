import type { SearchResult } from "./sources";

export interface RetrievalInput {
  query: string;
  results: SearchResult[];
  weight?: number;
}

export interface FusedSearchResult extends SearchResult {
  retrievalScore: number;
  lexicalScore: number;
  sourceCount: number;
  matchedQueries: string[];
}

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to", "with"]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

function lexicalScore(query: string, result: SearchResult): number {
  const queryTokens = tokens(query);
  const resultTokens = tokens(`${result.title} ${result.snippet ?? ""} ${result.url}`);
  if (!queryTokens.size) return 0;
  let matches = 0;
  for (const token of queryTokens) if (resultTokens.has(token)) matches += 1;
  return matches / queryTokens.size;
}

export function fuseSearchResults(inputs: RetrievalInput[], limit = 250): FusedSearchResult[] {
  const fused = new Map<string, FusedSearchResult>();

  for (const input of inputs) {
    const weight = input.weight ?? 1;
    input.results.forEach((result, index) => {
      const key = canonicalizeUrl(result.url);
      const rankScore = weight / (60 + index + 1);
      const lexical = lexicalScore(input.query, result);
      const existing = fused.get(key);
      if (!existing) {
        fused.set(key, {
          ...result,
          retrievalScore: rankScore + lexical,
          lexicalScore: lexical,
          sourceCount: 1,
          matchedQueries: [input.query],
        });
        return;
      }
      existing.retrievalScore += rankScore + lexical;
      existing.lexicalScore = Math.max(existing.lexicalScore, lexical);
      existing.sourceCount += existing.source === result.source ? 0 : 1;
      if (!existing.matchedQueries.includes(input.query)) existing.matchedQueries.push(input.query);
      if ((result.snippet?.length ?? 0) > (existing.snippet?.length ?? 0)) existing.snippet = result.snippet;
      if (result.title.length > existing.title.length) existing.title = result.title;
    });
  }

  return [...fused.values()]
    .sort((a, b) => b.retrievalScore - a.retrievalScore || b.sourceCount - a.sourceCount)
    .slice(0, limit);
}
