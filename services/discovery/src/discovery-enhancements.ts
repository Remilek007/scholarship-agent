export interface DiscoveryCandidateLike {
  url: string;
  title?: string;
  snippet?: string;
  source?: string;
  query?: string;
}

export interface DiscoveryEnhancementOptions {
  maxResults?: number;
  minScore?: number;
  preferredDomains?: string[];
}

export function canonicalizeDiscoveryUrl(input: string): string {
  try {
    const url = new URL(input.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) {
      url.searchParams.delete(key);
    }
    url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return input.trim().toLowerCase().replace(/\/$/, "");
  }
}

export function scoreDiscoveryCandidate(candidate: DiscoveryCandidateLike, options: DiscoveryEnhancementOptions = {}): number {
  const text = `${candidate.title ?? ""} ${candidate.snippet ?? ""} ${candidate.url}`.toLowerCase();
  let score = 0;
  const signals: RegExp[] = [
    /scholarship|fellowship|studentship|assistantship|grant|funded/, 
    /stipend|tuition|fully funded|full funding/, 
    /apply|application|deadline|eligibility|requirements/, 
    /master|msc|phd|doctoral|graduate|postgraduate/, 
    /international students|all nationalities|nigeria|africa/, 
  ];
  signals.forEach((signal, index) => {
    if (signal.test(text)) score += [5, 5, 4, 3, 2][index];
  });
  if (options.preferredDomains?.some(domain => candidate.url.includes(domain))) score += 4;
  return score;
}

export function enhanceDiscoveryCandidates<T extends DiscoveryCandidateLike>(
  candidates: T[],
  options: DiscoveryEnhancementOptions = {},
): T[] {
  const seen = new Set<string>();
  const maxResults = Math.max(1, options.maxResults ?? 250);
  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreDiscoveryCandidate(candidate, options) }))
    .filter(item => item.score >= (options.minScore ?? 0))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter(item => {
      const key = canonicalizeDiscoveryUrl(item.candidate.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxResults)
    .map(item => item.candidate);
}

export function buildExpandedDiscoveryQueries(profile: Record<string, unknown>): string[] {
  const country = String(profile.country ?? profile.nationality ?? "").trim();
  const field = String(profile.fieldOfStudy ?? profile.subject ?? profile.field ?? "").trim();
  const level = String(profile.studyLevel ?? profile.degreeLevel ?? "").trim();
  const terms = ["scholarship", "fellowship", "funded graduate opportunity", "studentship", "research funding"];
  const modifiers = ["official", "international students", "application deadline", "fully funded", "2026"];
  const queries = new Set<string>();
  for (const term of terms) {
    queries.add([term, field, level, country].filter(Boolean).join(" "));
    for (const modifier of modifiers) queries.add([term, modifier, field, level, country].filter(Boolean).join(" "));
  }
  return [...queries].filter(Boolean).slice(0, 40);
}
