export type VerificationStatus = "verified" | "partially_verified" | "unverified" | "suspicious";

export interface VerificationResult {
  status: VerificationStatus;
  trustLevel: number;
  officialSource: boolean;
  sourceUrl: string;
  finalUrl?: string;
  title?: string;
  evidence: string[];
  warnings: string[];
  checkedAt: string;
}

const officialPatterns = [/\.gov(?:\.[a-z]{2})?$/i, /\.edu(?:\.[a-z]{2})?$/i, /\.ac\.[a-z]{2}$/i, /\.ac\.uk$/i, /\.edu\.[a-z]{2}$/i];
const suspiciousPatterns = [/pay\s+(?:a\s+)?fee\s+to\s+(?:unlock|release|secure)/i, /guaranteed\s+scholarship/i, /send\s+(?:money|payment|crypto)\s+to/i, /whatsapp[- ]only/i, /personal\s+(?:bank|account)/i];

export async function verifySource(sourceUrl: string): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  let parsed: URL;
  try { parsed = new URL(sourceUrl); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol"); }
  catch { return { status: "suspicious", trustLevel: 1, officialSource: false, sourceUrl, evidence: [], warnings: ["Source URL is invalid"], checkedAt }; }

  try {
    const response = await fetch(parsed, { headers: { "user-agent": "ScholarshipAgent/0.1" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return { status: "unverified", trustLevel: 1, officialSource: isOfficialDomain(parsed.hostname), sourceUrl, finalUrl: response.url, evidence: [], warnings: [`Source returned HTTP ${response.status}`], checkedAt };
    const html = await response.text();
    const final = new URL(response.url || sourceUrl);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const officialSource = isOfficialDomain(final.hostname);
    const evidence: string[] = [];
    const warnings: string[] = [];
    if (officialSource) evidence.push(`Official-looking institutional domain: ${final.hostname}`);
    if (/scholarship|fellowship|studentship|funded|funding/i.test(`${title ?? ""} ${text}`)) evidence.push("Page contains scholarship/funding language");
    if (/deadline|apply|application|admission/i.test(text)) evidence.push("Page contains application/deadline language");
    const suspicious = suspiciousPatterns.filter((pattern) => pattern.test(text)).length;
    if (suspicious) warnings.push("Potential scam/payment language detected");
    if (!officialSource) warnings.push("Source domain is not classified as an official institutional domain");
    let trustLevel = officialSource ? 4 : 2;
    if (officialSource && evidence.length >= 3) trustLevel = 5;
    if (suspicious) trustLevel = 1;
    return { status: suspicious ? "suspicious" : trustLevel >= 5 ? "verified" : trustLevel >= 3 ? "partially_verified" : "unverified", trustLevel, officialSource, sourceUrl, finalUrl: final.toString(), title, evidence, warnings, checkedAt };
  } catch (error) {
    return { status: "unverified", trustLevel: 1, officialSource: isOfficialDomain(parsed.hostname), sourceUrl, evidence: [], warnings: [error instanceof Error ? error.message : "Unable to fetch source"], checkedAt };
  }
}

function isOfficialDomain(hostname: string): boolean {
  return officialPatterns.some((pattern) => pattern.test(hostname)) || /(?:university|college|government|\.gov\.|\.ac\.|\.edu\.)/i.test(hostname);
}
