import type { ApplicantProfile, ScholarshipCandidate, MatchResult } from "@scholarship-agent/shared";
import { assessEligibility } from "./eligibility";
import { isFundedEnough } from "./funding";
import { scoreFieldRelevance } from "./relevance";

export function scoreCandidate(profile: ApplicantProfile, candidate: ScholarshipCandidate): MatchResult {
  const fieldScore = scoreFieldRelevance({ title: candidate.title, fields: candidate.fields, snippet: candidate.eligibility?.text }, profile.targetFields);
  const fundingScore = isFundedEnough(candidate.fundingClass) ? 1 : 0;
  const academicScore = profile.academicScore !== undefined && profile.academicScale
    ? Math.min(1, Math.max(0, profile.academicScore / profile.academicScale))
    : 0.5;
  const deadlineScore = scoreDeadline(candidate.deadline);
  const eligibility = assessEligibility(profile, candidate);
  const profileScore = Math.min(1, fieldScore * 0.55 + academicScore * 0.45);
  const eligibilityScore = eligibility.status === "confirmed_eligible" ? 1 : eligibility.status === "probably_eligible" ? 0.8 : eligibility.status === "cannot_determine" ? 0.45 : 0;
  const overallScore = fieldScore * 0.35 + fundingScore * 0.25 + academicScore * 0.15 + eligibilityScore * 0.15 + deadlineScore * 0.10;

  return {
    eligibility: eligibility.status,
    fieldScore,
    fundingScore,
    academicScore,
    profileScore,
    deadlineScore,
    confidence: eligibility.confidence,
    overallScore,
    reasons: eligibility.reasons
  };
}

function scoreDeadline(deadline?: string): number {
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
