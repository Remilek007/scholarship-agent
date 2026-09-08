export interface DiscoverySourceDefinition {
  id: string;
  name: string;
  category: "university" | "government" | "foundation" | "international" | "research" | "scholarship_database" | "search";
  urls: string[];
  priority: number;
  enabledByDefault: boolean;
  notes: string;
}

/** Discovery seeds only. Every opportunity must be verified at its authoritative source. */
export const SOURCE_REGISTRY: DiscoverySourceDefinition[] = [
  { id: "erasmus-plus", name: "Erasmus+", category: "government", urls: ["https://erasmus-plus.ec.europa.eu/"], priority: 5, enabledByDefault: true, notes: "European Union mobility and funding" },
  { id: "daad", name: "DAAD", category: "government", urls: ["https://www.daad.de/en/"], priority: 5, enabledByDefault: true, notes: "German academic exchange and scholarships" },
  { id: "chevening", name: "Chevening", category: "government", urls: ["https://www.chevening.org/"], priority: 5, enabledByDefault: true, notes: "UK government scholarship program" },
  { id: "commonwealth", name: "Commonwealth Scholarships", category: "government", urls: ["https://cscuk.fcdo.gov.uk/"], priority: 5, enabledByDefault: true, notes: "Commonwealth scholarships and fellowships" },
  { id: "fulbright", name: "Fulbright", category: "government", urls: ["https://foreign.fulbrightonline.org/"], priority: 5, enabledByDefault: true, notes: "International graduate study and exchange" },
  { id: "australia-awards", name: "Australia Awards", category: "government", urls: ["https://www.australiaawards.gov.au/"], priority: 5, enabledByDefault: true, notes: "Australian government development scholarships" },
  { id: "mext", name: "Study in Japan / MEXT", category: "government", urls: ["https://www.studyinjapan.go.jp/en/"], priority: 5, enabledByDefault: true, notes: "Japanese government scholarship information" },
  { id: "study-in-sweden", name: "Study in Sweden", category: "government", urls: ["https://studyinsweden.se/"], priority: 4, enabledByDefault: true, notes: "Swedish higher education and funding discovery" },
  { id: "study-in-finland", name: "Study in Finland", category: "government", urls: ["https://www.studyinfinland.fi/"], priority: 4, enabledByDefault: true, notes: "Finnish higher education discovery" },
  { id: "nuffic", name: "Nuffic", category: "government", urls: ["https://www.nuffic.nl/en"], priority: 4, enabledByDefault: true, notes: "Dutch international education information" },
  { id: "scholarshipportal", name: "ScholarshipPortal", category: "scholarship_database", urls: ["https://www.scholarshipportal.com/"], priority: 3, enabledByDefault: true, notes: "Discovery only; verify official provider" },
  { id: "opportunities-for-africans", name: "Opportunities for Africans", category: "scholarship_database", urls: ["https://opportunitiesforafricans.com/"], priority: 3, enabledByDefault: true, notes: "Africa-focused discovery; verify official provider" },
  { id: "mastersportal", name: "Mastersportal", category: "scholarship_database", urls: ["https://www.mastersportal.com/"], priority: 3, enabledByDefault: true, notes: "Master's program discovery; funding requires verification" },
  { id: "findaphd", name: "FindAPhD", category: "research", urls: ["https://www.findaphd.com/"], priority: 3, enabledByDefault: true, notes: "Research-position discovery" },
  { id: "euraxess", name: "EURAXESS", category: "research", urls: ["https://euraxess.ec.europa.eu/"], priority: 4, enabledByDefault: true, notes: "European research and funding discovery" },
  { id: "researchgate", name: "ResearchGate", category: "research", urls: ["https://www.researchgate.net/"], priority: 2, enabledByDefault: false, notes: "Discovery only; never authoritative funding evidence" },
  { id: "unesco", name: "UNESCO", category: "international", urls: ["https://www.unesco.org/"], priority: 4, enabledByDefault: true, notes: "Education and science opportunities" },
  { id: "unep", name: "UNEP", category: "international", urls: ["https://www.unep.org/"], priority: 4, enabledByDefault: true, notes: "Environment and conservation ecosystem" },
  { id: "fao", name: "FAO", category: "international", urls: ["https://www.fao.org/"], priority: 5, enabledByDefault: true, notes: "Forestry, natural resources and food systems" },
  { id: "iucn", name: "IUCN", category: "international", urls: ["https://www.iucn.org/"], priority: 5, enabledByDefault: true, notes: "Conservation and biodiversity ecosystem" },
  { id: "cifor-icraf", name: "CIFOR-ICRAF", category: "research", urls: ["https://www.cifor-icraf.org/"], priority: 5, enabledByDefault: true, notes: "Forestry, agroforestry, climate and landscape research" },
  { id: "wri", name: "World Resources Institute", category: "research", urls: ["https://www.wri.org/"], priority: 4, enabledByDefault: true, notes: "Forests, climate, land and natural resources" },
  { id: "wwf", name: "WWF", category: "research", urls: ["https://www.worldwildlife.org/"], priority: 3, enabledByDefault: true, notes: "Wildlife and conservation research ecosystem" },
  { id: "forest-trends", name: "Forest Trends", category: "research", urls: ["https://www.forest-trends.org/"], priority: 3, enabledByDefault: true, notes: "Forests, markets and conservation research" },
  { id: "global-environment-facility", name: "Global Environment Facility", category: "international", urls: ["https://www.thegef.org/"], priority: 4, enabledByDefault: true, notes: "Environment and biodiversity funding ecosystem" },
  { id: "university-search", name: "University and department sites", category: "university", urls: [], priority: 5, enabledByDefault: true, notes: "Search official university departments, labs and funding pages" }
];

export function getEnabledSourceRegistry(): DiscoverySourceDefinition[] { return SOURCE_REGISTRY.filter(source => source.enabledByDefault); }
export function getSourceRegistryUrls(): string[] { return getEnabledSourceRegistry().flatMap(source => source.urls); }
