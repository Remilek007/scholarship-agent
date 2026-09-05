export interface ExtractedRequirement {
  name: string;
  required: boolean;
  sourceInstruction: string;
}

const requirementPatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: "Academic transcript", pattern: /transcript|academic record|statement of results/i },
  { name: "Degree certificate", pattern: /degree certificate|certificate of graduation|graduation certificate/i },
  { name: "Curriculum vitae", pattern: /curriculum vitae|\bcv\b|resume/i },
  { name: "Personal statement", pattern: /personal statement|statement of purpose|\bsop\b/i },
  { name: "Research proposal", pattern: /research proposal|research plan|study proposal/i },
  { name: "Recommendation letters", pattern: /recommendation letter|reference letter|letters of recommendation|referee/i },
  { name: "Proof of English proficiency", pattern: /ielts|toefl|english language proficiency|proof of english/i },
  { name: "Passport or identification", pattern: /passport|proof of identity|national id/i },
  { name: "Proof of nationality", pattern: /proof of nationality|citizenship certificate|nationality/i },
  { name: "CV or resume", pattern: /curriculum vitae|\bcv\b|resume/i },
  { name: "Portfolio", pattern: /portfolio/i },
  { name: "Writing sample", pattern: /writing sample|sample of writing/i }
];

const sectionPattern = /(?:required documents|application documents|supporting documents|documents required|how to apply|application requirements)[\s:]*([\s\S]{0,7000})/i;

export function extractApplicationRequirements(htmlOrText: string): ExtractedRequirement[] {
  const text = normalizeText(htmlOrText);
  const section = text.match(sectionPattern)?.[1] ?? text;
  const results: ExtractedRequirement[] = [];
  const seen = new Set<string>();

  for (const item of requirementPatterns) {
    const match = section.match(item.pattern);
    if (!match) continue;
    const context = contextAround(section, match.index ?? 0);
    const required = !/optional|may submit|if applicable|where applicable|not required/i.test(context);
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ name: item.name, required, sourceInstruction: context.slice(0, 500) });
  }

  return results;
}

function normalizeText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function contextAround(text: string, index: number): string {
  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + 420);
  return text.slice(start, end).trim();
}
