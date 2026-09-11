import type { ApplicantProfile } from "@scholarship-agent/shared";
import { buildApplicantIntelligence } from "./profile-intelligence";

const fields = ["forestry", "forest science", "forest management", "silviculture", "forest ecology", "tropical forestry", "wildlife conservation", "wildlife management", "wildlife ecology", "zoology", "conservation biology", "biodiversity", "restoration ecology", "natural resource management", "ecosystem management", "agroforestry", "community forestry", "forest carbon", "REDD+", "climate adaptation", "environmental management", "environmental policy", "remote sensing", "geospatial", "GIS"];
const discoveryIntents = ["fully funded scholarship", "funded master's", "funded MSc", "studentship", "graduate research position", "research assistantship", "funded thesis", "supervisor funded MSc", "funded graduate position", "MSc research project"];
const authoritativeDomains = ["daad.de", "chevening.org", "cscuk.fcdo.gov.uk", "fulbrightonline.org", "australiaawards.gov.au", "studyinjapan.go.jp", "studyinsweden.se", "studyinfinland.fi", "nuffic.nl", "erasmus-plus.ec.europa.eu", "euraxess.ec.europa.eu", "fao.org", "iucn.org", "unep.org", "unesco.org", "cifor-icraf.org", "wri.org", "wwf.org", "forest-trends.org", "thegef.org"];

export function buildDiscoveryQueries(profile: ApplicantProfile): string[] {
  const intelligence = buildApplicantIntelligence(profile);
  const nationality = profile.nationality || "international";
  const degree = profile.degreeLevel === "masters" ? "master's MSc" : profile.degreeLevel;
  const selected = intelligence.normalizedFields.length ? intelligence.normalizedFields : fields.slice(0, 8);
  const queries = new Set<string>();
  const add = (query: string) => { const normalized = query.trim().replace(/\s+/g, " "); if (normalized && queries.size < 72) queries.add(normalized); };
  for (const field of selected.slice(0, 10)) {
    add(`"${field}" "fully funded" ${degree} "${nationality}"`);
    add(`"${field}" funded MSc "international students"`);
    add(`"${field}" studentship graduate research`);
  }
  for (const theme of intelligence.researchThemes.slice(0, 6)) {
    add(`"${theme}" funded MSc research position`);
    add(`"${theme}" graduate research assistantship studentship`);
  }
  for (const skill of intelligence.skills.slice(0, 4)) {
    add(`"${skill}" forestry conservation funded master's`);
    add(`"${skill}" wildlife biodiversity graduate research funding`);
  }
  for (const field of selected.slice(0, 5)) {
    add(`"${field}" "funded MSc" supervisor professor lab`);
    add(`"${field}" master's funding university department`);
  }
  for (const intent of discoveryIntents) add(`"${intent}" ${selected.slice(0, 3).join(" ")} ${degree} "${nationality}"`);
  add(`forestry wildlife conservation funded master's "${nationality}"`);
  add(`forest ecology biodiversity funded graduate research position`);
  add(`natural resources climate funded MSc research position`);
  add(`remote sensing GIS forestry funded master's`);
  for (const domain of authoritativeDomains) {
    add(`site:${domain} forestry conservation ${degree} funding`);
    add(`site:${domain} "funded" "international students" forestry`);
  }
  return [...queries];
}
export function getForestryTerms(): string[] { return [...fields]; }
export function getAuthoritativeSearchDomains(): string[] { return [...authoritativeDomains]; }
export { buildApplicantIntelligence } from "./profile-intelligence";
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
export { planDiscoveryQueries } from "./query-planner";
export type { DiscoveryIntent, PlannedQuery } from "./query-planner";
export { fuseSearchResults } from "./hybrid-retrieval";
export type { FusedSearchResult, RetrievalInput } from "./hybrid-retrieval";
