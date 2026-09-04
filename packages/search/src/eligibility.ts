import type { ApplicantProfile, DegreeLevel, EligibilityStatus, ScholarshipCandidate } from "@scholarship-agent/shared";
import { isFundedEnough } from "./funding";
import { scoreFieldRelevance } from "./relevance";

export interface EligibilityAssessment {
  status: EligibilityStatus;
  confidence: number;
  reasons: string[];
}

const degreeAliases: Record<DegreeLevel, string[]> = {
  masters: ["master", "master's", "msc", "m.sc", "ma", "graduate"],
  phd: ["phd", "doctorate", "doctoral"],
  undergraduate: ["bachelor", "bachelor's", "bsc", "b.sc", "undergraduate"],
  other: []
};

export function assessEligibility(profile: ApplicantProfile, candidate: ScholarshipCandidate): EligibilityAssessment {
  const reasons: string[] = [];
  let confidence = 0.5;
  const text = [candidate.title, candidate.provider, candidate.university, candidate.country, ...candidate.fields, candidate.eligibility?.text]
    .filter(Boolean).join(" ").toLowerCase();

  if (!isFundedEnough(candidate.fundingClass)) {
    return { status: "not_eligible", confidence: 0.99, reasons: ["Funding does not meet the minimum requirement"] };
  }
  if (candidate.deadline) {
    const deadline = new Date(candidate.deadline).getTime();
    if (Number.isFinite(deadline) && deadline < Date.now()) {
      return { status: "not_eligible", confidence: 0.99, reasons: ["Application deadline has passed"] };
    }
  }
  if (candidate.degreeLevel && candidate.degreeLevel !== profile.degreeLevel) {
    return { status: "not_eligible", confidence: 0.99, reasons: [`Opportunity is for ${candidate.degreeLevel}, not ${profile.degreeLevel}`] };
  }

  const degreeTerms = degreeAliases[profile.degreeLevel] ?? [];
  const hasDegreeSignal = degreeTerms.some((term) => text.includes(term));
  if (profile.degreeLevel === "masters" && hasDegreeSignal) reasons.push("Master's-level study is indicated");
  else if (profile.degreeLevel === "masters") reasons.push("Master's level is not explicitly confirmed yet");

  const evidence = candidate.eligibility;
  const nationality = profile.nationality.trim().toLowerCase();
  const eligible = (evidence?.eligibleNationalities ?? []).map((v) => v.toLowerCase());
  const excluded = (evidence?.excludedNationalities ?? []).map((v) => v.toLowerCase());
  if (excluded.some((v) => v === nationality || v.includes(nationality) || nationality.includes(v))) {
    return { status: "not_eligible", confidence: 0.98, reasons: [`Applicant nationality (${profile.nationality}) is explicitly excluded`] };
  }
  if (eligible.some((v) => v === nationality || v.includes(nationality) || nationality.includes(v))) {
    reasons.push(`Applicant nationality (${profile.nationality}) is explicitly eligible`);
    confidence += 0.2;
  } else if (evidence?.internationalStudents || /international students|all nationalities|any nationality|open to international applicants/.test(text)) {
    reasons.push("International applicants appear to be eligible");
    confidence += 0.12;
  } else {
    reasons.push(`Applicant nationality (${profile.nationality}) is not explicitly confirmed yet`);
  }

  const minimum = evidence?.minimumAcademicScore;
  const scale = evidence?.academicScale ?? profile.academicScale;
  if (minimum !== undefined && profile.academicScore !== undefined && scale) {
    const applicant = profile.academicScore / scale;
    const required = minimum / (evidence?.academicScale ?? scale);
    if (applicant < required) {
      return { status: "not_eligible", confidence: 0.97, reasons: [`Academic score is below the stated minimum (${minimum}/${evidence?.academicScale ?? scale})`] };
    }
    reasons.push("Academic score meets the stated minimum");
    confidence += 0.15;
  } else if (minimum !== undefined) {
    reasons.push(`Minimum academic requirement detected: ${minimum}/${evidence?.academicScale ?? "unknown scale"}`);
  } else {
    reasons.push("No explicit academic threshold was extracted");
  }

  const fieldScore = scoreFieldRelevance({ title: candidate.title, fields: candidate.fields, snippet: candidate.eligibility?.text }, profile.targetFields);
  if (fieldScore < 0.35) {
    return { status: "cannot_determine", confidence: Math.min(confidence, 0.55), reasons: [...reasons, "Field relevance is too weak to confirm eligibility"] };
  }
  reasons.push(fieldScore >= 0.9 ? "Strong Forestry/Wildlife or closely related field fit" : "Related environmental field fit detected");

  confidence = Math.min(0.98, confidence);
  const nationalityKnown = eligible.length > 0 || evidence?.internationalStudents === true || /international students|all nationalities|any nationality|nigeria|nigerian/.test(text);
  const status: EligibilityStatus = hasDegreeSignal && nationalityKnown && (minimum === undefined || profile.academicScore !== undefined)
    ? "probably_eligible"
    : "cannot_determine";
  return { status, confidence, reasons };
}

export function extractEligibilityEvidence(text: string) {
  const normalized = text.toLowerCase();
  const internationalStudents = /international students|international applicants|all nationalities|any nationality|open to international/.test(normalized);
  const eligibleNationalities: string[] = [];
  if (/nigeria|nigerian/.test(normalized)) eligibleNationalities.push("Nigeria");
  const excludedNationalities: string[] = [];
  if (/not eligible.*nigeria|nigeria.*not eligible|excluding.*nigeria/.test(normalized)) excludedNationalities.push("Nigeria");

  const minimumMatch = normalized.match(/(?:minimum|at least|required|equivalent to)\s*(?:a\s*)?(?:gpa|cgpa|grade point average)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/i);
  return {
    internationalStudents: internationalStudents || undefined,
    eligibleNationalities: eligibleNationalities.length ? eligibleNationalities : undefined,
    excludedNationalities: excludedNationalities.length ? excludedNationalities : undefined,
    minimumAcademicScore: minimumMatch ? Number(minimumMatch[1]) : undefined,
    academicScale: minimumMatch?.[2] ? Number(minimumMatch[2]) : undefined,
    text
  };
}
