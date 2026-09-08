import type { OpportunityType, ScholarshipCandidate } from "@scholarship-agent/shared";

export interface QualityAssessment {
  score: number;
  tier: "strong" | "good" | "review" | "reject";
  reasons: string[];
  warnings: string[];
}

const RESEARCH_TYPES = new Set<OpportunityType>(["research_position", "studentship", "assistantship"]);

export function assessOpportunityQuality(candidate: ScholarshipCandidate, verified = false): QualityAssessment {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (candidate.degreeLevel === "masters") { score += 20; reasons.push("Master's-level opportunity"); } else if (candidate.degreeLevel === "phd") { score -= 20; warnings.push("PhD-level opportunity"); }
  if (candidate.fields.some(field => /forestry|forest|wildlife|conservation|biodiversity|natural resource|climate|remote sensing|gis/i.test(field))) { score += 25; reasons.push("Strong environmental/forestry field relevance"); }
  if (candidate.fundingClass === "fully_funded") { score += 30; reasons.push("Fully funded"); }
  else if (candidate.fundingClass === "substantially_funded") { score += 22; reasons.push("Substantially funded"); }
  else if (candidate.fundingClass === "partial" || candidate.fundingClass === "unfunded") { score -= 30; warnings.push("Does not meet full/substantial funding target"); }
  if (candidate.opportunityType && RESEARCH_TYPES.has(candidate.opportunityType)) { score += 12; reasons.push("Funded research pathway"); }
  if (candidate.applicationUrl) { score += 5; reasons.push("Application route detected"); } else warnings.push("Application route not detected");
  if (candidate.deadline) { score += 5; reasons.push("Deadline detected"); } else warnings.push("Deadline not detected");
  if (verified) { score += 8; reasons.push("Source verified"); }
  score = Math.max(0, Math.min(100, score));
  const tier = score >= 75 ? "strong" : score >= 55 ? "good" : score >= 30 ? "review" : "reject";
  return { score, tier, reasons, warnings };
}

export function deduplicateCandidates(candidates: ScholarshipCandidate[]): ScholarshipCandidate[] {
  const groups = new Map<string, ScholarshipCandidate>();
  for (const candidate of candidates) {
    const key = canonicalOpportunityKey(candidate);
    const existing = groups.get(key);
    if (!existing || candidateQuality(candidate) > candidateQuality(existing)) groups.set(key, candidate);
  }
  return [...groups.values()];
}

function candidateQuality(candidate: ScholarshipCandidate): number {
  return (candidate.fundingClass === "fully_funded" ? 4 : candidate.fundingClass === "substantially_funded" ? 3 : candidate.fundingClass === "partial" ? 1 : 0) + (candidate.applicationUrl ? 1 : 0) + (candidate.deadline ? 1 : 0) + (candidate.fields.length > 0 ? 1 : 0);
}

function canonicalOpportunityKey(candidate: ScholarshipCandidate): string {
  const title = candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const provider = (candidate.provider ?? "").toLowerCase().replace(/^www\./, "");
  const country = (candidate.country ?? "").toLowerCase().trim();
  return `${title}|${provider}|${country}`;
}
