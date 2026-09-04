import type { ApplicantProfile } from "@scholarship-agent/shared";

const fields = [
  "forestry", "forest science", "forest management", "silviculture",
  "forest ecology", "tropical forestry", "wildlife conservation",
  "wildlife management", "conservation biology", "biodiversity",
  "natural resource management", "ecosystem management", "agroforestry",
  "community forestry", "forest carbon", "REDD+", "remote sensing", "GIS"
];

const fundingTerms = [
  "fully funded", "full scholarship", "tuition waiver stipend",
  "funded master's", "funded MSc", "graduate assistantship",
  "research assistantship", "funded research position"
];

export function buildDiscoveryQueries(profile: ApplicantProfile): string[] {
  const degree = profile.degreeLevel === "masters" ? "master's MSc" : profile.degreeLevel;
  const nationality = profile.nationality;
  const selected = profile.targetFields.length ? profile.targetFields : fields.slice(0, 6);
  const queries = new Set<string>();

  for (const field of selected) {
    for (const funding of fundingTerms.slice(0, 4)) {
      queries.add(`"${funding}" "${field}" ${degree} "${nationality}"`);
      queries.add(`"${field}" "${funding}" international students`);
    }
    queries.add(`"${field}" "funded master's" scholarship ${nationality}`);
    queries.add(`"${field}" "funded MSc" research position`);
  }

  return [...queries];
}

export function getForestryTerms(): string[] {
  return [...fields];
}

export { classifyFunding, isFundedEnough } from "./funding";
export { scoreCandidate } from "./matching";
export type { SearchProvider, SearchResult } from "./sources";
export { uniqueSearchResults } from "./sources";
