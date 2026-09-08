import { extractApplicationRequirements, type ExtractedRequirement } from "./requirements";

export interface DeepExtractionResult {
  sourceUrl: string;
  finalUrl: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  text: string;
  applicationUrl?: string;
  deadline?: string;
  fundingEvidence: string[];
  eligibilityEvidence: string[];
  degreeEvidence: string[];
  structuredEvidence: string[];
  requirements: ExtractedRequirement[];
  links: Array<{ label: string; url: string }>;
  extractedAt: string;
}

const MAX_TEXT = 30_000;
const MAX_EVIDENCE = 8;
const DATE_PATTERN = /(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+\d{4})/i;

export async function deepExtractPage(sourceUrl: string): Promise<DeepExtractionResult> {
  const extractedAt = new Date().toISOString();
  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "ScholarshipAgent/0.2 (+deep-extraction)" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);

  const finalUrl = response.url || sourceUrl;
  const html = await response.text();
  const structured = extractStructuredData(html);
  const text = visibleText(html, structured).slice(0, MAX_TEXT);
  const links = extractLinks(html, finalUrl);
  const metadata = extractMetadata(html);

  return {
    sourceUrl,
    finalUrl,
    canonicalUrl: extractCanonicalUrl(html, finalUrl),
    title: metadata.title ?? structured.title ?? extractTitle(html),
    description: metadata.description ?? structured.description,
    text,
    applicationUrl: findApplicationUrl(links, structured.applicationUrl),
    deadline: extractDeadline(text) ?? structured.deadline,
    fundingEvidence: evidence(text, /fully funded|fully-funded|full funding|tuition|stipend|living allowance|maintenance allowance|accommodation|studentship|assistantship|funded research|funding package/gi),
    eligibilityEvidence: evidence(text, /international students|eligible nationalit|citizenship|Nigerian|Nigeria|all nationalities|eligib|residency|minimum GPA|minimum CGPA|minimum grade|academic requirement/gi),
    degreeEvidence: evidence(text, /master'?s|MSc|M\.Sc\.|Master of Science|postgraduate|graduate degree/gi),
    structuredEvidence: structured.evidence,
    requirements: extractApplicationRequirements(text),
    links: links.slice(0, 60),
    extractedAt
  };
}

function visibleText(html: string, structured: StructuredData): string {
  const structuredText = structured.evidence.join(" ");
  return decode(html
    .replace(/<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ") + " " + structuredText)
    .replace(/\s+/g, " ").trim();
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decode(match[1]).trim() || undefined : undefined;
}

function extractMetadata(html: string): { title?: string; description?: string } {
  const title = readMeta(html, ["og:title", "twitter:title"]);
  const description = readMeta(html, ["description", "og:description", "twitter:description"]);
  return { title, description };
}

function readMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decode(match[1]).replace(/\s+/g, " ").trim() || undefined;
    }
  }
  return undefined;
}

function extractCanonicalUrl(html: string, baseUrl: string): string | undefined {
  const match = html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  if (!match?.[1]) return undefined;
  try { return new URL(decode(match[1]), baseUrl).toString(); } catch { return undefined; }
}

interface StructuredData {
  title?: string;
  description?: string;
  applicationUrl?: string;
  deadline?: string;
  evidence: string[];
}

function extractStructuredData(html: string): StructuredData {
  const result: StructuredData = { evidence: [] };
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const raw = decode(match[1]).trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      for (const item of flattenJsonLd(parsed)) {
        if (!result.title && typeof item.name === "string") result.title = item.name.trim();
        if (!result.description && typeof item.description === "string") result.description = item.description.trim();
        const url = typeof item.url === "string" ? item.url : typeof item.sameAs === "string" ? item.sameAs : undefined;
        if (!result.applicationUrl && url && /apply|application|admission|portal/i.test(url)) result.applicationUrl = url;
        if (!result.deadline) {
          const dateValue = firstString(item, ["endDate", "validThrough", "applicationDeadline", "deadline", "closingDate"]);
          if (dateValue && DATE_PATTERN.test(dateValue)) result.deadline = dateValue;
        }
        const fragments = [item.name, item.description, item.text, item.jobTitle, item.educationRequirements, item.occupationalCategory]
          .filter((value): value is string => typeof value === "string");
        result.evidence.push(...fragments.map(value => value.replace(/\s+/g, " ").trim()).filter(Boolean));
      }
    } catch { /* malformed JSON-LD is non-fatal */ }
  }
  return { ...result, evidence: unique(result.evidence).slice(0, MAX_EVIDENCE) };
}

function flattenJsonLd(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const graph = record["@graph"];
  return [record, ...(graph ? flattenJsonLd(graph) : [])];
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  return undefined;
}

function extractLinks(html: string, baseUrl: string): Array<{ label: string; url: string }> {
  const results: Array<{ label: string; url: string }> = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const label = decode(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!label) continue;
    try { results.push({ label: label.slice(0, 200), url: new URL(decode(match[1]), baseUrl).toString() }); }
    catch { /* ignore malformed links */ }
  }
  return uniqueLinks(results);
}

function findApplicationUrl(links: Array<{ label: string; url: string }>, structuredUrl?: string): string | undefined {
  if (structuredUrl) return structuredUrl;
  return links.find((link) => /apply now|apply here|apply|application portal|online application|admission portal/i.test(link.label))?.url
    ?? links.find((link) => /apply|application|admission/i.test(link.url))?.url;
}

function extractDeadline(text: string): string | undefined {
  const patterns = [
    /(?:application|submission|applications?)\s+(?:deadline|due|closes?)[:\s]+([^.;]{4,100})/i,
    /(?:deadline|closing date|application closes?|apply by)[:\s]+([^.;]{4,100})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (!value) continue;
    const date = value.match(DATE_PATTERN)?.[0];
    if (date) return date;
  }
  const standalone = text.match(new RegExp(`(?:deadline|closing date|apply by)[^.!?]{0,100}?(${DATE_PATTERN.source})`, "i"));
  return standalone?.[1];
}

function evidence(text: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const snippet = text.slice(Math.max(0, index - 180), Math.min(text.length, index + 420)).trim();
    if (snippet && !results.includes(snippet)) results.push(snippet);
    if (results.length >= MAX_EVIDENCE) break;
  }
  return results;
}

function uniqueLinks(items: Array<{ label: string; url: string }>): Array<{ label: string; url: string }> {
  const seen = new Set<string>();
  return items.filter(item => { const key = item.url.replace(/#.*$/, ""); if (seen.has(key)) return false; seen.add(key); return true; });
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter(item => { const key = item.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}

function decode(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">" ).replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}
