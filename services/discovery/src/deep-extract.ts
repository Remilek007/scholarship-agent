import { extractApplicationRequirements, type ExtractedRequirement } from "./requirements";

export interface DeepExtractionResult {
  sourceUrl: string;
  finalUrl: string;
  title?: string;
  text: string;
  applicationUrl?: string;
  deadline?: string;
  fundingEvidence: string[];
  eligibilityEvidence: string[];
  degreeEvidence: string[];
  requirements: ExtractedRequirement[];
  links: Array<{ label: string; url: string }>;
  extractedAt: string;
}

const MAX_TEXT = 30_000;
const MAX_EVIDENCE = 8;

export async function deepExtractPage(sourceUrl: string): Promise<DeepExtractionResult> {
  const extractedAt = new Date().toISOString();
  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "ScholarshipAgent/0.1 (+deep-extraction)" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);

  const finalUrl = response.url || sourceUrl;
  const html = await response.text();
  const text = visibleText(html).slice(0, MAX_TEXT);
  const links = extractLinks(html, finalUrl);

  return {
    sourceUrl,
    finalUrl,
    title: extractTitle(html),
    text,
    applicationUrl: findApplicationUrl(links),
    deadline: extractDeadline(text),
    fundingEvidence: evidence(text, /fully funded|fully-funded|full funding|tuition|stipend|living allowance|accommodation|studentship|assistantship|funded research/gi),
    eligibilityEvidence: evidence(text, /international students|eligible nationalit|citizenship|Nigerian|Nigeria|eligib|residency|minimum GPA|minimum grade|academic requirement/gi),
    degreeEvidence: evidence(text, /master'?s|MSc|M\.Sc\.|Master of Science|postgraduate|graduate degree/gi),
    requirements: extractApplicationRequirements(text),
    links: links.slice(0, 40),
    extractedAt
  };
}

function visibleText(html: string): string {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decode(match[1]).trim() || undefined : undefined;
}

function extractLinks(html: string, baseUrl: string): Array<{ label: string; url: string }> {
  const results: Array<{ label: string; url: string }> = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const label = decode(match[2]).replace(/\s+/g, " ").trim();
    if (!label) continue;
    try { results.push({ label: label.slice(0, 200), url: new URL(decode(match[1]), baseUrl).toString() }); }
    catch { /* ignore malformed links */ }
  }
  return results;
}

function findApplicationUrl(links: Array<{ label: string; url: string }>): string | undefined {
  return links.find((link) => /apply now|apply|application portal|online application|admission portal/i.test(link.label))?.url
    ?? links.find((link) => /apply|application|admission/i.test(link.url))?.url;
}

function extractDeadline(text: string): string | undefined {
  const patterns = [
    /(?:application|submission|applications?)\s+(?:deadline|due|closes?)[:\s]+([^.;]{4,80})/i,
    /(?:deadline|closing date|application closes?)[:\s]+([^.;]{4,80})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
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

function decode(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}
