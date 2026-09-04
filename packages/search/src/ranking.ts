import type { ApplicantProfile, ScholarshipCandidate } from "@scholarship-agent/shared";
import { isFundedEnough } from "./funding";
import { scoreFieldRelevance } from "./relevance";

export interface RankedCandidate extends ScholarshipCandidate {
  score: number;
  reasons: string[];
  deadlineScore: number;
  eligibilityGate: "pass" | "review" | "fail";
}

export function rankCandidates(profile: ApplicantProfile, candidates: ScholarshipCandidate[]): RankedCandidate[] {
  return candidates.map((candidate) => {
    const field = scoreFieldRelevance({ title: candidate.title, fields: candidate.fields }, profile.targetFields);
    const funding = isFundedEnough(candidate.fundingClass) ? 1 : 0;
    const academic = profile.academicScore !== undefined && profile.academicScale
      ? Math.min(1, Math.max(0, profile.academicScore / profile.academicScale))
      : 0.5;
    const deadline = deadlineScore(candidate.deadline);
    const eligibilityGate = gate(candidate, profile, field, funding);

    // Funding is a hard requirement for this agent. Unknown/partial funding
    // stays out of the qualifying pool even when field relevance is excellent.
    const score = eligibilityGate === "fail"
      ? Math.min(0.39, field * 0.35 + funding * 0.2 + academic * 0.15 + deadline * 0.05)
      : field * 0.4 + funding * 0.25 + academic * 0.2 + deadline * 0.15;

    const reasons = [
      field >= 0.9 ? "Strong Forestry/Wildlife field relevance" : field >= 0.6 ? "Related environmental field" : "Weak field relevance",
      funding ? "Funding meets the minimum requirement" : "Funding is not verified as sufficient",
      deadline >= 0.8 ? "Deadline is active and relatively soon" : deadline > 0 ? "Deadline is active" : "Deadline is not yet known"
    ];
    if (eligibilityGate === "review") reasons.push("Some eligibility details still need verification");
    if (eligibilityGate === "fail") reasons.push("Does not currently pass the funded Master's qualification gate");

    return { ...candidate, score, reasons, deadlineScore: deadline, eligibilityGate };
  }).sort((a, b) => b.score - a.score);
}

function gate(candidate: ScholarshipCandidate, profile: ApplicantProfile, field: number, funding: number): "pass" | "review" | "fail" {
  if (!funding) return "fail";
  if (candidate.degreeLevel && candidate.degreeLevel !== profile.degreeLevel) return "fail";
  if (field < 0.35) return "review";
  return "pass";
}

function deadlineScore(deadline?: string): number {
  if (!deadline) return 0.35;
  const time = new Date(deadline).getTime();
  if (!Number.isFinite(time)) return 0;
  const days = (time - Date.now()) / 86_400_000;
  if (days < 0) return 0;
  if (days <= 7) return 1;
  if (days <= 30) return 0.9;
  if (days <= 90) return 0.7;
  if (days <= 180) return 0.5;
  return 0.25;
}
