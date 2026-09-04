import type { DegreeLevel, FundingClass, ScholarshipCandidate } from "@scholarship-agent/shared";
import { classifyFunding, type FundingEvidence } from "@scholarship-agent/search";
import type { DiscoveryRecord } from "./index";

export interface NormalizedScholarship extends ScholarshipCandidate {
  canonicalKey: string;
  evidence: { title: string; snippet?: string; sourceUrl: string };
}

const degreePatterns: Array<[RegExp, DegreeLevel]> = [
  [/\b(master'?s|msc|ma|m\.sc\.)\b/i, "masters"],
  [/\b(phd|doctorate|doctoral)\b/i, "phd"],
  [/\b(bachelor'?s|bsc|ba|b\.sc\.)\b/i, "undergraduate"]
];

const fieldTerms = [
  "forestry", "forest science", "forest management", "silviculture", "forest ecology",
  "wildlife", "wildlife conservation", "wildlife management", "conservation biology",
  "biodiversity", "natural resource management", "ecosystem management", "restoration ecology",
  "agroforestry", "community forestry", "forest carbon", "REDD+", "remote sensing", "GIS"
];

export function normalizeDiscoveryRecord(record: DiscoveryRecord): NormalizedScholarship {
  const title = clean(record.title || "Untitled scholarship opportunity");
  const text = title;
  const degreeLevel = detectDegree(text);
  const fields = fieldTerms.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
  const evidence: FundingEvidence = { text };
  const fundingClass: FundingClass = classifyFunding(evidence);

  return {
    title,
    provider: record.source,
    degreeLevel,
    fields,
    sourceUrl: record.url,
    fundingClass,
    canonicalKey: canonicalKey(title, record.source),
    evidence: { title, sourceUrl: record.url }
  };
}

export function normalizeDiscoveryRecords(records: DiscoveryRecord[]): NormalizedScholarship[] {
  const seen = new Set<string>();
  return records.reduce<NormalizedScholarship[]>((items, record) => {
    const item = normalizeDiscoveryRecord(record);
    if (!seen.has(item.canonicalKey)) {
      seen.add(item.canonicalKey);
      items.push(item);
    }
    return items;
  }, []);
}

function detectDegree(text: string): DegreeLevel | undefined {
  for (const [pattern, level] of degreePatterns) if (pattern.test(text)) return level;
  return undefined;
}

function canonicalKey(title: string, provider?: string): string {
  return `${normalizeText(title)}::${normalizeText(provider ?? "")}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
