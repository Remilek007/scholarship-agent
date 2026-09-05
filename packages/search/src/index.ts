import type { ApplicantProfile } from "@scholarship-agent/shared";

const fields = ["forestry", "forest science", "forest management", "silviculture", "forest ecology", "tropical forestry", "wildlife conservation", "wildlife management", "conservation biology", "biodiversity", "natural resource management", "ecosystem management", "agroforestry", "community forestry", "forest carbon", "REDD+", "remote sensing", "GIS"];
const fundingTerms = ["fully funded", "full scholarship", "tuition waiver stipend", "funded master's", "funded MSc", "graduate assistantship", "research assistantship", "funded research position", "funded thesis"];
const discoveryIntents = [
  "scholarship", "funded master's", "funded MSc", "graduate research position", "research assistantship", "studentship", "fellowship",
  "funded MSc position", "funded master's research position", "MSc student funded project", "MSc studentship forestry",
  "graduate research assistant forestry", "supervisor funded MSc forestry", "funded graduate student forest ecology",
  "funded MSc wildlife conservation", "research assistantship forest management", "funded thesis forestry"
];

export function buildDiscoveryQueries(profile: ApplicantProfile): string[] {
  const degree = profile.degreeLevel === "masters" ? "master's MSc" : profile.degreeLevel;
  const nationality = profile.nationality;
  const selected = profile.targetFields.length ? profile.targetFields : fields.slice(0, 8);
  const queries = new Set<string>();
  for (const field of selected) {
    for (const funding of fundingTerms) {
      queries.add(`"${funding}" "${field}" ${degree} "${nationality}"`);
      queries.add(`"${field}" "${funding}" international students`);
    }
    for (const intent of discoveryIntents) {
      queries.add(`"${field}" "${intent}" ${nationality}`);
      queries.add(`"${field}" "${intent}" international students`);
    }
    queries.add(`"${field}" funded research project master's supervisor`);
    queries.add(`"${field}" MSc scholarship university department funding`);
    queries.add(`"${field}" funded graduate position professor lab`);
  }
  return [...queries];
}

export function getForestryTerms(): string[] { return [...fields]; }
export { classifyFunding, isFundedEnough } from "./funding";
export type { FundingEvidence } from "./funding";
export { assessEligibility, extractEligibilityEvidence } from "./eligibility";
export { scoreCandidate } from "./matching";
export { rankCandidates } from "./ranking";
export { scoreFieldRelevance } from "./relevance";
export type { SearchProvider, SearchResult } from "./sources";
export { uniqueSearchResults } from "./sources";
export { PublicSearchProvider, RssSearchProvider } from "./providers";
