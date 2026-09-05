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

const officialPatterns = [
  /(^|\.)gov\.[a-z]{2,}$/i,
  /(^|\.)gov\.[a-z]{2}\.[a-z]{2}$/i,
  /(^|\.)edu$/i,
  /(^|\.)edu\.[a-z]{2,}$/i,
  /(^|\.)ac\.[a-z]{2,}$/i,
  /(^|\.)ac\.[a-z]{2}\.[a-z]{2}$/i
];

const suspiciousPatterns = [
  /pay\s+(?:a\s+)?fee\s+to\s+(?:unlock|release|secure)/i,
  /guaranteed\s+scholarship/i,
  /send\s+(?:money|payment|crypto)\s+to/i,
  /whatsapp[- ]only/i,
  /personal\s+(?:bank|account)/i,
  /pay\s+to\s+apply/i
];

export async function verifySource(sourceUrl: string): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
  } catch {
    return { status: "suspicious", trustLevel: 1, officialSource: false, sourceUrl, evidence: [], warnings: ["Source URL is invalid"], checkedAt };
  }

  try {
    const response = await fetch(parsed, {
      headers: { "user-agent": "ScholarshipAgent/0.1 (+source-verification)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000)
    });
    const final = new URL(response.url || sourceUrl);
    const officialSource = isOfficialDomain(final.hostname);

    if (!response.ok) {
      return { status: "unverified", trustLevel: officialSource ? 3 : 1, officialSource, sourceUrl, finalUrl: final.toString(), evidence: [], warnings: [`Source returned HTTP ${response.status}`], checkedAt };
    }

    const html = await response.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const combined = `${title ?? ""} ${text}`;
    const evidence: string[] = [];
    const warnings: string[] = [];

    if (officialSource) evidence.push(`Institutional/government-style domain: ${final.hostname}`);
    if (/scholarship|fellowship|studentship|funded|funding/i.test(combined)) evidence.push("Page contains scholarship/funding language");
    if (/deadline|apply|application|admission/i.test(text)) evidence.push("Page contains application/deadline language");
    if (/eligib(?:le|ility)|international students|nationality|citizenship/i.test(text)) evidence.push("Page contains eligibility language");

    const suspicious = suspiciousPatterns.filter((pattern) => pattern.test(text)).length;
    if (suspicious) warnings.push("Potential scam/payment language detected");
    if (!officialSource) warnings.push("Source domain is not on the institutional-domain heuristic list");
    if (final.hostname !== parsed.hostname) warnings.push(`Redirected from ${parsed.hostname} to ${final.hostname}`);

    let trustLevel = officialSource ? 4 : 2;
    if (officialSource && evidence.length >= 3) trustLevel = 5;
    if (suspicious) trustLevel = 1;
    if (!officialSource && final.hostname !== parsed.hostname) trustLevel = Math.min(trustLevel, 2);

    return { status: suspicious ? "suspicious" : trustLevel >= 5 ? "verified" : trustLevel >= 3 ? "partially_verified" : "unverified", trustLevel, officialSource, sourceUrl, finalUrl: final.toString(), title, evidence, warnings, checkedAt };
  } catch (error) {
    return { status: "unverified", trustLevel: 1, officialSource: isOfficialDomain(parsed.hostname), sourceUrl, evidence: [], warnings: [error instanceof Error ? error.message : "Unable to fetch source"], checkedAt };
  }
}

function isOfficialDomain(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return officialPatterns.some((pattern) => pattern.test(host));
}
