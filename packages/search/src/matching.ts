import type { ApplicantProfile, ScholarshipCandidate, MatchResult } from "@scholarship-agent/shared";
import { isFundedEnough } from "./funding";
import { assessEligibility } from "./eligibility";
import { scoreFieldRelevance } from "./relevance";

export function scoreCandidate(profile: ApplicantProfile, candidate: ScholarshipCandidate): MatchResult {
  const eligibility = assessEligibility(profile, candidate);
  const fieldScore = scoreFieldRelevance({ title: candidate.title, fields: candidate.fields, snippet: candidate.eligibility?.text }, profile.targetFields);
  const fundingScore = isFundedEnough(candidate.fundingClass) ? 1 : 0;
  const academicScore = profile.academicScore !== undefined && profile.academicScale ? Math.min(1, Math.max(0, profile.academicScore / profile.academicScale)) : 0.5;
  const deadlineScore = deadlineUrgency(candidate.deadline);
  const profileScore = Math.min(1, fieldScore * 0.55 + academicScore * 0.25 + skillEvidenceScore(profile, candidate) * 0.2);
  const reasons = [...eligibility.reasons];
  if (fundingScore) reasons.push("Funding meets the minimum funded requirement");
  if (profile.degreeField && textIncludes(candidate, profile.degreeField)) reasons.push(`Academic discipline matches: ${profile.degreeField}`);
  const skills = extractProfileTerms(profile.workExperience ?? "");
  const matchedSkills = skills.filter(skill => textIncludes(candidate, skill));
  if (matchedSkills.length) reasons.push(`Profile/CV evidence matches: ${matchedSkills.slice(0, 4).join(", ")}`);
  if (deadlineScore >= 0.9) reasons.push("Deadline is approaching"); else if (!candidate.deadline) reasons.push("Deadline is not yet verified");
  const overallScore = eligibility.status === "not_eligible" ? 0 : fieldScore * 0.4 + fundingScore * 0.25 + academicScore * 0.15 + profileScore * 0.1 + deadlineScore * 0.1;
  return { eligibility: eligibility.status, fieldScore, fundingScore, academicScore, profileScore, deadlineScore, confidence: eligibility.confidence, overallScore, reasons };
}

function skillEvidenceScore(profile: ApplicantProfile, candidate: ScholarshipCandidate): number { const terms = extractProfileTerms(profile.workExperience ?? ""); if (!terms.length) return 0.5; const matched = terms.filter(term => textIncludes(candidate, term)).length; return Math.min(1, matched / Math.min(5, terms.length)); }
function extractProfileTerms(text: string): string[] { const patterns = [/\bQGIS\b/i,/\bArcGIS\b/i,/\bPython\b/i,/\bRStudio\b/i,/\bremote sensing\b/i,/\bGIS\b/i,/\bGPS\b/i,/\bdata analysis\b/i,/\bfield research\b/i,/\bresearch\b/i,/\bconservation\b/i,/\bforest management\b/i,/\bwildlife\b/i,/\bbiodiversity\b/i]; return patterns.filter(pattern => pattern.test(text)).map(pattern => text.match(pattern)?.[0] ?? "").filter(Boolean); }
function textIncludes(candidate: ScholarshipCandidate, term: string): boolean { const haystack = [candidate.title, ...(candidate.fields ?? []), candidate.eligibility?.text ?? "", candidate.funding?.text ?? ""].join(" ").toLowerCase(); return haystack.includes(term.toLowerCase()); }
function deadlineUrgency(deadline?: string): number { if (!deadline) return 0.35; const time = new Date(deadline).getTime(); if (!Number.isFinite(time)) return 0; const days = (time - Date.now()) / 86_400_000; if (days < 0) return 0; if (days <= 7) return 1; if (days <= 30) return 0.9; if (days <= 90) return 0.7; if (days <= 180) return 0.5; return 0.25; }
