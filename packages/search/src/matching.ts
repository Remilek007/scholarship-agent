import type { ApplicantProfile, ScholarshipCandidate, MatchResult } from "@scholarship-agent/shared";
import { isFundedEnough } from "./funding";
import { assessEligibility } from "./eligibility";
import { scoreFieldRelevance } from "./relevance";
import { buildApplicantIntelligence } from "./profile-intelligence";

export function scoreCandidate(profile: ApplicantProfile, candidate: ScholarshipCandidate): MatchResult {
  const intelligence = buildApplicantIntelligence(profile);
  const eligibility = assessEligibility(profile, candidate);
  const fieldScore = scoreFieldRelevance({ title: candidate.title, fields: candidate.fields, snippet: candidate.eligibility?.text }, intelligence.normalizedFields);
  const fundingScore = isFundedEnough(candidate.fundingClass) ? 1 : 0;
  const academicScore = academicFit(profile, candidate);
  const skillScore = matchTerms(candidate, intelligence.skills);
  const researchScore = matchTerms(candidate, intelligence.researchThemes);
  const opportunityScore = candidate.opportunityType && intelligence.opportunityTypes.includes(candidate.opportunityType) ? 1 : 0.5;
  const deadlineScore = deadlineUrgency(candidate.deadline);
  const profileScore = Math.min(1, fieldScore * 0.45 + researchScore * 0.2 + skillScore * 0.15 + academicScore * 0.15 + opportunityScore * 0.05);
  const reasons = [...eligibility.reasons];
  if (fundingScore) reasons.push("Funding meets the minimum funded requirement");
  if (profile.degreeField && textIncludes(candidate, profile.degreeField)) reasons.push(`Academic discipline matches: ${profile.degreeField}`);
  const matchedSkills = intelligence.skills.filter(skill => textIncludes(candidate, skill));
  if (matchedSkills.length) reasons.push(`Profile/CV evidence matches: ${matchedSkills.slice(0, 5).join(", ")}`);
  const matchedResearch = intelligence.researchThemes.filter(theme => textIncludes(candidate, theme));
  if (matchedResearch.length) reasons.push(`Research alignment: ${matchedResearch.slice(0, 4).join(", ")}`);
  if (deadlineScore >= 0.9) reasons.push("Deadline is approaching"); else if (!candidate.deadline) reasons.push("Deadline is not yet verified");

  const overallScore = eligibility.status === "not_eligible" || !fundingScore
    ? 0
    : fieldScore * 0.35 + fundingScore * 0.2 + academicScore * 0.12 + researchScore * 0.12 + skillScore * 0.07 + deadlineScore * 0.04 + eligibility.confidence * 0.05 + opportunityScore * 0.05;
  return { eligibility: eligibility.status, fieldScore, fundingScore, academicScore, profileScore, deadlineScore, confidence: eligibility.confidence, overallScore, reasons };
}

function academicFit(profile: ApplicantProfile, candidate: ScholarshipCandidate): number {
  if (profile.academicScore === undefined || !profile.academicScale) return 0.5;
  const applicantRatio = Math.max(0, Math.min(1, profile.academicScore / profile.academicScale));
  const minimum = candidate.eligibility?.minimumAcademicScore;
  const scale = candidate.eligibility?.academicScale ?? profile.academicScale;
  if (minimum === undefined || !scale) return applicantRatio;
  return profile.academicScore >= minimum ? Math.min(1, 0.75 + (applicantRatio - minimum / scale) * 0.5) : Math.max(0, applicantRatio * 0.5);
}

function matchTerms(candidate: ScholarshipCandidate, terms: string[]): number {
  if (!terms.length) return 0.5;
  const matched = terms.filter(term => textIncludes(candidate, term));
  return Math.min(1, matched.length / Math.min(5, terms.length));
}
function textIncludes(candidate: ScholarshipCandidate, term: string): boolean {
  const haystack = [candidate.title, candidate.provider, candidate.university, ...(candidate.fields ?? []), candidate.eligibility?.text ?? "", ...(candidate.requirements ?? []).map(item => `${item.name} ${item.details ?? ""} ${item.evidence ?? ""}`)].join(" ").toLowerCase();
  return haystack.includes(term.toLowerCase());
}
function deadlineUrgency(deadline?: string): number {
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
