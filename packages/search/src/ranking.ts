import type { ApplicantProfile, ScholarshipCandidate } from "@scholarship-agent/shared";
import { isFundedEnough } from "./funding";
import { scoreFieldRelevance } from "./relevance";

export interface RankedCandidate extends ScholarshipCandidate {
  score: number;
  reasons: string[];
}

export function rankCandidates(profile: ApplicantProfile, candidates: ScholarshipCandidate[]): RankedCandidate[] {
  return candidates.map((candidate) => {
    const field = scoreFieldRelevance({ title: candidate.title, fields: candidate.fields }, profile.targetFields);
    const funding = isFundedEnough(candidate.fundingClass) ? 1 : 0;
    const academic = profile.academicScore && profile.academicScale ? Math.min(1, profile.academicScore / profile.academicScale) : 0.5;
    const deadline = deadlineScore(candidate.deadline);
    const score = field * 0.4 + funding * 0.3 + academic * 0.2 + deadline * 0.1;
    const reasons = [
      field >= 0.9 ? "Strong Forestry/Wildlife field relevance" : field >= 0.6 ? "Related environmental field" : "Weak field relevance",
      funding ? "Funding meets the minimum requirement" : "Funding is not verified as sufficient",
      deadline > 0 ? "Deadline information is available" : "Deadline is not yet known"
    ];
    return { ...candidate, score, reasons };
  }).sort((a, b) => b.score - a.score);
}

function deadlineScore(deadline?: string): number {
  if (!deadline) return 0;
  const time = new Date(deadline).getTime();
  if (!Number.isFinite(time)) return 0;
  return time >= Date.now() ? 1 : 0;
}
