import type { ApplicantProfile } from "@scholarship-agent/shared";

const fields = ["forestry", "forest science", "forest management", "silviculture", "forest ecology", "tropical forestry", "wildlife conservation", "wildlife management", "conservation biology", "biodiversity", "natural resource management", "ecosystem management", "agroforestry", "community forestry", "forest carbon", "REDD+", "remote sensing", "GIS"];
const discoveryIntents = ["fully funded scholarship", "funded master's", "funded MSc", "studentship", "graduate research position", "research assistantship", "funded thesis", "supervisor funded MSc"];
const authoritativeDomains = ["daad.de", "chevening.org", "cscuk.fcdo.gov.uk", "fulbrightonline.org", "australiaawards.gov.au", "studyinjapan.go.jp", "studyinsweden.se", "studyinfinland.fi", "nuffic.nl", "erasmus-plus.ec.europa.eu", "euraxess.ec.europa.eu", "fao.org", "iucn.org", "unep.org", "unesco.org", "cifor-icraf.org"];

/** Generate a bounded, high-diversity query plan. Search APIs are paid/limited resources, so the planner deliberately avoids a Cartesian product. */
export function buildDiscoveryQueries(profile: ApplicantProfile): string[] {
  const degree = profile.degreeLevel === "masters" ? "master's MSc" : profile.degreeLevel;
  const nationality = profile.nationality || "international";
  const selected = profile.targetFields.length ? profile.targetFields : fields.slice(0, 8);
  const queries = new Set<string>();
  const add = (query: string) => { if (queries.size < 80) queries.add(query.trim()); };

  for (const field of selected) {
    add(`"${field}" "fully funded" ${degree} "${nationality}"`);
    add(`"${field}" scholarship ${degree} "international students"`);
    add(`"${field}" funding stipend ${degree} "international students"`);
    add(`"${field}" funded MSc research position`);
    add(`"${field}" graduate research assistantship`);
    add(`"${field}" studentship funded thesis`);
    add(`"${field}" supervisor funded MSc professor lab`);
    add(`"${field}" master's funding university department`);
  }

  for (const intent of discoveryIntents) {
    add(`"${intent}" forestry wildlife conservation ${degree} "${nationality}"`);
  }

  add(`forestry wildlife conservation funded master's "${nationality}"`);
  add(`forestry wildlife conservation funded MSc "international students"`);
  add(`forest ecology biodiversity funded graduate research position`);
  add(`natural resources climate funded MSc research position`);
  add(`remote sensing GIS forestry funded master's`);

  for (const domain of authoritativeDomains) {
    add(`site:${domain} forestry scholarship ${degree}`);
    add(`site:${domain} "funded" "international students" forestry`);
  }
  return [...queries];
}
export function getForestryTerms(): string[] { return [...fields]; }
export function getAuthoritativeSearchDomains(): string[] { return [...authoritativeDomains]; }
export { classifyFunding, isFundedEnough } from "./funding";
export type { FundingEvidence } from "./funding";
export { assessEligibility, extractEligibilityEvidence } from "./eligibility";
export { scoreCandidate } from "./matching";
export { rankCandidates } from "./ranking";
export { scoreFieldRelevance } from "./relevance";
export { prepareApplicationIntelligence } from "./application";
export type { ApplicationAnswerDraft, ApplicationPreparation, ApplicationQuestion } from "./application";
export { analyzeApplicantDocument } from "./document-intelligence";
export type { DocumentAnalysis, DocumentFact } from "./document-intelligence";
export type { SearchProvider, SearchResult } from "./sources";
export { uniqueSearchResults } from "./sources";
export { BraveSearchProvider, PublicSearchProvider, RssSearchProvider, TavilySearchProvider } from "./providers";
export { extractEvidence, classifyFundingEvidence } from "./evidence";
export type { EvidenceItem } from "./evidence";
