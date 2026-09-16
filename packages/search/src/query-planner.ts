import type { ApplicantProfile } from "@scholarship-agent/shared";
import { buildApplicantIntelligence } from "./profile-intelligence";

export type DiscoveryIntent =
  | "scholarship"
  | "studentship"
  | "research-position"
  | "assistantship"
  | "thesis-project"
  | "departmental-funding"
  | "supervisor-funded";

export interface PlannedQuery {
  query: string;
  intent: DiscoveryIntent;
  priority: number;
  officialOnly?: boolean;
}

const funding = ["fully funded", "funded", "tuition waiver stipend", "scholarship stipend", "studentship"];
const positionTerms = ["MSc research position", "master's research project", "graduate research assistantship", "funded thesis project", "supervisor funded MSc", "research studentship"];
const officialDomains = ["edu", "ac.uk", "edu.au", "edu.ca", "daad.de", "chevening.org", "cscuk.fcdo.gov.uk", "australiaawards.gov.au", "studyinjapan.go.jp", "studyinsweden.se", "studyinfinland.fi", "euraxess.ec.europa.eu", "fao.org", "iucn.org", "cifor-icraf.org"];

export function planDiscoveryQueries(profile: ApplicantProfile): PlannedQuery[] {
  const intelligence = buildApplicantIntelligence(profile);
  const fields = (intelligence.normalizedFields.length ? intelligence.normalizedFields : ["forestry", "wildlife conservation", "natural resources"]).slice(0, 10);
  const themes = intelligence.researchThemes.slice(0, 5);
  const nationality = profile.nationality || "international students";
  const degree = profile.degreeLevel === "masters" ? "master's MSc" : profile.degreeLevel;
  const countries = (profile.countriesOfInterest ?? []).slice(0, 4);
  const output: PlannedQuery[] = [];
  const seen = new Set<string>();
  const add = (query: string, intent: DiscoveryIntent, priority: number, officialOnly = false) => {
    const normalized = query.replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized) || output.length >= 36) return;
    seen.add(normalized);
    output.push({ query: normalized, intent, priority, officialOnly });
  };

  for (const field of fields) {
    add(`"${field}" ${degree} fully funded ${nationality}`, "scholarship", 100);
    add(`"${field}" funded MSc studentship`, "studentship", 98);
    add(`"${field}" graduate research position funding`, "research-position", 96);
    add(`"${field}" research assistantship master's`, "assistantship", 94);
    add(`"${field}" funded thesis project`, "thesis-project", 92);
    if (countries.length) add(`"${field}" ${degree} funding ${countries.join(" OR ")}`, "scholarship", 91);
  }
  for (const theme of themes) {
    add(`"${theme}" funded graduate research position`, "research-position", 95);
    add(`"${theme}" MSc studentship stipend`, "studentship", 93);
  }
  for (const term of funding) add(`${term} ${fields.slice(0, 3).join(" ")} ${degree} ${nationality}`, "scholarship", 80);
  for (const term of positionTerms) add(`${term} ${fields.slice(0, 3).join(" ")}`, "research-position", 85);

  for (const domain of officialDomains) {
    add(`site:${domain} ${fields[0]} funded ${degree}`, "scholarship", 110, true);
    add(`site:${domain} ${fields[0]} studentship research`, "studentship", 108, true);
  }
  return output.sort((a, b) => b.priority - a.priority);
}
