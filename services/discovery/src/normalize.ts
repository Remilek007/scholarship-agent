import type { DegreeLevel, FundingClass, ScholarshipCandidate } from "@scholarship-agent/shared";
import { classifyFunding, type FundingEvidence } from "@scholarship-agent/search";
import type { DiscoveryRecord } from "./index";

export interface NormalizedScholarship extends ScholarshipCandidate {
  canonicalKey: string;
  evidence: { title: string; snippet?: string; sourceUrl: string };
}

const degreePatterns: Array<[RegExp, DegreeLevel]> = [
  [/\b(master'?s|msc|m\.sc\.?|ma)\b/i, "masters"],
  [/\b(phd|doctorate|doctoral)\b/i, "phd"],
  [/\b(bachelor'?s|bsc|b\.sc\.?|ba)\b/i, "undergraduate"]
];

const fieldTerms = [
  "forestry", "forest science", "forest management", "silviculture", "forest ecology",
  "wildlife", "wildlife conservation", "wildlife management", "conservation biology",
  "biodiversity", "natural resource management", "ecosystem management", "restoration ecology",
  "agroforestry", "community forestry", "forest carbon", "REDD+", "remote sensing", "GIS"
];

export function normalizeDiscoveryRecord(record: DiscoveryRecord): NormalizedScholarship {
  const title = clean(record.title) ?? "Untitled scholarship opportunity";
  const snippet = clean(record.snippet);
  const text = `${title} ${snippet ?? ""}`;
  const lower = text.toLowerCase();
  const degreeLevel = detectDegree(text);
  const fields = fieldTerms.filter((term) => lower.includes(term.toLowerCase()));
  const evidence: FundingEvidence = {
    text,
    tuitionCovered: /full tuition|100% tuition|tuition (fee )?waiver|fees fully covered|fees covered in full/i.test(text),
    stipendMentioned: /stipend|living allowance|maintenance allowance|monthly allowance|living costs covered/i.test(text),
    accommodationCovered: /accommodation|housing|residential costs/i.test(text),
    travelCovered: /travel (grant|allowance|costs)|flight|airfare|relocation/i.test(text),
    insuranceCovered: /health insurance|medical insurance/i.test(text)
  };
  const fundingClass: FundingClass = classifyFunding(evidence);
  const deadline = detectDeadline(text);
  const applicationUrl = detectApplicationUrl(snippet, record.url);

  return {
    title,
    provider: inferProvider(record.source, record.url),
    degreeLevel,
    fields,
    sourceUrl: record.url,
    applicationUrl,
    fundingClass,
    deadline,
    canonicalKey: canonicalKey(title, record.source),
    evidence: { title, snippet, sourceUrl: record.url }
  };
}

export function normalizeDiscoveryRecords(records: DiscoveryRecord[]): NormalizedScholarship[] {
  const seen = new Set<string>();
  return records.reduce<NormalizedScholarship[]>((items, record) => {
    const item = normalizeDiscoveryRecord(record);
    if (!seen.has(item.canonicalKey)) { seen.add(item.canonicalKey); items.push(item); }
    return items;
  }, []);
}

function detectDegree(text: string): DegreeLevel | undefined {
  for (const [pattern, level] of degreePatterns) if (pattern.test(text)) return level;
  return undefined;
}

function detectDeadline(text: string): string | undefined {
  const patterns = [
    /(?:deadline|apply by|application closes?|applications? close)\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /(?:deadline|apply by|applications? close)\s*[:\-]?\s*(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const date = new Date(match[1]);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return undefined;
}

function detectApplicationUrl(snippet: string | undefined, sourceUrl: string): string | undefined {
  if (!snippet) return undefined;
  const match = snippet.match(/(?:apply|application|admission)[^:]{0,80}:\s*(https?:\/\/[^\s|]+)/i);
  if (!match) return undefined;
  try { return new URL(match[1], sourceUrl).toString(); } catch { return undefined; }
}

function inferProvider(source: string, url: string): string | undefined {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return source || undefined; }
}

function canonicalKey(title: string, provider?: string): string {
  return `${normalizeText(title)}::${normalizeText(provider ?? "")}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function clean(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}
