import type { ApplicantProfile, ScholarshipCandidate, MatchResult } from "@scholarship-agent/shared";
import { isFundedEnough } from "./funding";

const fieldAliases: Record<string, string[]> = {
  forestry: ["forestry", "forest science", "forest management", "silviculture"],
  wildlife: ["wildlife", "wildlife conservation", "wildlife management", "zoology"],
  conservation: ["conservation", "biodiversity", "ecosystem", "restoration"],
  climate: ["climate", "forest carbon", "redd+", "adaptation", "mitigation"],
  geospatial: ["gis", "remote sensing", "geospatial", "forest monitoring"]
};

export function scoreCandidate(profile: ApplicantProfile, candidate: ScholarshipCandidate): MatchResult {
  const haystack = [candidate.title, ...candidate.fields].join(" ").toLowerCase();
  const requested = profile.targetFields.length ? profile.targetFields : ["forestry", "wildlife", "conservation"];
  const matched = requested.filter((field) => {
    const aliases = fieldAliases[field.toLowerCase()] ?? [field.toLowerCase()];
    return aliases.some((alias) => haystack.includes(alias));
  });

  const fieldScore = Math.min(1, matched.length / Math.max(1, requested.length));
  const fundingScore = isFundedEnough(candidate.fundingClass) ? 1 : 0;
  const academicScore = profile.academicScore && profile.academicScale
    ? Math.min(1, profile.academicScore / profile.academicScale)
    : 0.5;

  const reasons: string[] = [];
  if (matched.length) reasons.push(`Field match: ${matched.join(", ")}`);
  else reasons.push("No strong target-field match detected");
  if (fundingScore) reasons.push("Funding meets the minimum funded requirement");
  else reasons.push("Funding is not yet sufficient or verified");

  const overallScore = fieldScore * 0.4 + fundingScore * 0.35 + academicScore * 0.25;
  const eligibility = fundingScore === 0
    ? "cannot_determine"
    : fieldScore >= 0.5 ? "probably_eligible" : "cannot_determine";

  return { eligibility, fieldScore, fundingScore, academicScore, overallScore, reasons };
}
