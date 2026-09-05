export interface DiscoverySourceDefinition {
  id: string;
  name: string;
  category: "university" | "government" | "foundation" | "international" | "research" | "scholarship_database" | "search";
  urls: string[];
  priority: number;
  enabledByDefault: boolean;
  notes: string;
}

/**
 * Seed catalog for broad discovery. These are discovery starting points, not
 * evidence of eligibility or funding. Individual opportunities must still be
 * verified against their authoritative source before recommendation.
 */
export const SOURCE_REGISTRY: DiscoverySourceDefinition[] = [
  { id: "erasmus-plus", name: "Erasmus+", category: "government", urls: ["https://erasmus-plus.ec.europa.eu/"], priority: 5, enabledByDefault: true, notes: "European Union mobility and funding programs" },
  { id: "daad", name: "DAAD", category: "government", urls: ["https://www.daad.de/en/"], priority: 5, enabledByDefault: true, notes: "German academic exchange and scholarship information" },
  { id: "chevening", name: "Chevening", category: "government", urls: ["https://www.chevening.org/"], priority: 5, enabledByDefault: true, notes: "UK government international scholarship program" },
  { id: "commonwealth", name: "Commonwealth Scholarships", category: "government", urls: ["https://cscuk.fcdo.gov.uk/"], priority: 5, enabledByDefault: true, notes: "UK Commonwealth scholarship and fellowship programs" },
  { id: "fulbright", name: "Fulbright", category: "government", urls: ["https://foreign.fulbrightonline.org/"], priority: 5, enabledByDefault: true, notes: "International graduate study and exchange programs" },
  { id: "australia-awards", name: "Australia Awards", category: "government", urls: ["https://www.australiaawards.gov.au/"], priority: 5, enabledByDefault: true, notes: "Australian government development scholarships" },
  { id: "mext", name: "Study in Japan / MEXT", category: "government", urls: ["https://www.studyinjapan.go.jp/en/"], priority: 5, enabledByDefault: true, notes: "Japanese government scholarship information" },
  { id: "study-in-sweden", name: "Study in Sweden", category: "government", urls: ["https://studyinsweden.se/"], priority: 4, enabledByDefault: true, notes: "Swedish higher education and scholarship discovery" },
  { id: "study-in-finland", name: "Study in Finland", category: "government", urls: ["https://www.studyinfinland.fi/"], priority: 4, enabledByDefault: true, notes: "Finnish higher education discovery" },
  { id: "nuffic", name: "Nuffic", category: "government", urls: ["https://www.nuffic.nl/en"], priority: 4, enabledByDefault: true, notes: "Dutch international education information" },
  { id: "scholarshipportal", name: "ScholarshipPortal", category: "scholarship_database", urls: ["https://www.scholarshipportal.com/"], priority: 3, enabledByDefault: true, notes: "Broad scholarship discovery; verify against official provider" },
  { id: "opportunities-for-africans", name: "Opportunities for Africans", category: "scholarship_database", urls: ["https://opportunitiesforafricans.com/"], priority: 3, enabledByDefault: true, notes: "Africa-focused opportunity discovery; verify against official provider" },
  { id: "mastersportal", name: "Mastersportal", category: "scholarship_database", urls: ["https://www.mastersportal.com/"], priority: 3, enabledByDefault: true, notes: "Master's program discovery; funding requires authoritative verification" },
  { id: "findaphd", name: "FindAPhD", category: "research", urls: ["https://www.findaphd.com/"], priority: 3, enabledByDefault: true, notes: "Research-position discovery with some Master's-adjacent funding leads" },
  { id: "euraxess", name: "EURAXESS", category: "research", urls: ["https://euraxess.ec.europa.eu/"], priority: 4, enabledByDefault: true, notes: "European research and funding opportunity discovery" },
  { id: "researchgate", name: "ResearchGate", category: "research", urls: ["https://www.researchgate.net/"], priority: 2, enabledByDefault: false, notes: "Research-network discovery; never treat posts as authoritative funding evidence" },
  { id: "unesco", name: "UNESCO", category: "international", urls: ["https://www.unesco.org/"], priority: 4, enabledByDefault: true, notes: "International education, science and environment opportunities" },
  { id: "unep", name: "UNEP", category: "international", urls: ["https://www.unep.org/"], priority: 4, enabledByDefault: true, notes: "Environment and conservation ecosystem for opportunity leads" },
  { id: "fao", name: "FAO", category: "international", urls: ["https://www.fao.org/"], priority: 4, enabledByDefault: true, notes: "Forestry, natural resources and food-system opportunities" },
  { id: "iucn", name: "IUCN", category: "international", urls: ["https://www.iucn.org/"], priority: 4, enabledByDefault: true, notes: "Conservation and biodiversity research/program ecosystem" },
  { id: "cifor-icraf", name: "CIFOR-ICRAF", category: "research", urls: ["https://www.cifor-icraf.org/"], priority: 5, enabledByDefault: true, notes: "Forestry, agroforestry, climate and landscape research" },
  { id: "wri", name: "World Resources Institute", category: "research", urls: ["https://www.wri.org/"], priority: 3, enabledByDefault: true, notes: "Forests, climate, land and natural-resource research leads" },
  { id: "wwf", name: "WWF", category: "research", urls: ["https://www.worldwildlife.org/"], priority: 3, enabledByDefault: true, notes: "Wildlife and conservation research/funding ecosystem" },
  { id: "university-search", name: "University and department sites", category: "university", urls: [], priority: 5, enabledByDefault: true, notes: "Use search discovery to reach official university departments, labs and funding pages" }
];

export function getEnabledSourceRegistry(): DiscoverySourceDefinition[] {
  return SOURCE_REGISTRY.filter((source) => source.enabledByDefault);
}

export function getSourceRegistryUrls(): string[] {
  return getEnabledSourceRegistry().flatMap((source) => source.urls);
}
