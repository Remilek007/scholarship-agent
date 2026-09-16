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

  if (!isFundedEnough(candidate.fundingClass, profile.minimumFunding)) {
    return { status: "not_eligible", confidence: 0.99, reasons: ["Funding does not meet the applicant's minimum requirement"] };
  }
  if (candidate.deadline) {
    const deadline = new Date(candidate.deadline).getTime();
    if (Number.isFinite(deadline) && deadline < Date.now()) {
      return { status: "not_eligible", confidence: 0.99, reasons: ["Application deadline has passed"] };
    }
  }
  if (candidate.degreeLevel && profile.degreeLevel !== "other" && candidate.degreeLevel !== profile.degreeLevel) {
    return { status: "not_eligible", confidence: 0.99, reasons: [`Opportunity is for ${candidate.degreeLevel}, not ${profile.degreeLevel}`] };
  }
  if (candidate.country && profile.excludedCountries?.some((country) => samePlace(country, candidate.country!))) {
    return { status: "not_eligible", confidence: 0.98, reasons: [`Opportunity country (${candidate.country}) is excluded by the applicant`] };
  }

  if (candidate.country && profile.excludedCountries?.some((country) => samePlace(country, candidate.country))) {
    return { status: "not_eligible", confidence: 0.98, reasons: [`Opportunity country (${candidate.country}) is excluded by the applicant`] };
  }

  const degreeTerms = degreeAliases[profile.degreeLevel] ?? [];
  const hasDegreeSignal = profile.degreeLevel === "other" || degreeTerms.some((term) => text.includes(term));
  if (profile.degreeLevel !== "other") {
    const degreeLabel = profile.degreeLevel === "masters" ? "Master's" : profile.degreeLevel === "phd" ? "PhD" : "Undergraduate";
    reasons.push(hasDegreeSignal ? `${degreeLabel}-level study is indicated` : `${degreeLabel} level is not explicitly confirmed yet`);
  }

  const evidence = candidate.eligibility;
  const nationality = profile.nationality.trim().toLowerCase();
  const eligible = (evidence?.eligibleNationalities ?? []).map((v) => v.toLowerCase());
  const excluded = (evidence?.excludedNationalities ?? []).map((v) => v.toLowerCase());
  if (excluded.some((v) => samePlace(v, nationality))) {
    return { status: "not_eligible", confidence: 0.98, reasons: [`Applicant nationality (${profile.nationality}) is explicitly excluded`] };
  }
  if (eligible.some((v) => samePlace(v, nationality))) {
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
  reasons.push(fieldScore >= 0.9 ? "Strong target-field relevance" : "Related target-field relevance detected");

  confidence = Math.min(0.98, confidence);
  const nationalityKnown = eligible.length > 0 || evidence?.internationalStudents === true || /international students|all nationalities|any nationality|open to international applicants/.test(text);
  const status: EligibilityStatus = hasDegreeSignal && nationalityKnown && (minimum === undefined || profile.academicScore !== undefined)
    ? "probably_eligible"
    : "cannot_determine";
  return { status, confidence, reasons };
}

function samePlace(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

export function extractEligibilityEvidence(text: string) {
  const normalized = text.toLowerCase();
  const internationalStudents = /international students|international applicants|all nationalities|any nationality|open to international/.test(normalized);
  const eligibleNationalities = extractNationalityList(normalized, false);
  const excludedNationalities = extractNationalityList(normalized, true);

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

function extractNationalityList(text: string, excluded: boolean): string[] {
  const patterns = excluded
    ? [/(?:not eligible|ineligible|excluding|excluded|except(?: for)?)\s+(?:for\s+)?(?:citizens?|nationals?|residents?)?\s*(?:of|from)?\s*([^.;\n]+)/gi]
    : [/(?:eligible|eligibility|available)\s+(?:to|for)?\s*(?:citizens?|nationals?|residents?)?\s*(?:of|from)\s+([^.;\n]+)/gi, /(?:citizens?|nationals?|residents?)\s+(?:of|from)\s+([^.;\n]+)/gi];
  const values: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const segment = match[1]?.replace(/\([^)]*\)/g, "").trim();
      if (!segment || /all countries|all nationalities|international|any nationality/.test(segment)) continue;
      for (const value of segment.split(/,|\s+and\s+|\s+or\s+/)) {
        const cleaned = value.trim().replace(/^(the|all)\s+/i, "").replace(/\s+(only|applicants?)$/i, "");
        if (cleaned.length >= 3 && cleaned.length <= 60 && /^[a-z][a-z .'-]+$/i.test(cleaned)) values.push(toDisplayNationality(cleaned));
      }
    }
  }
  return [...new Set(values)];
}

function toDisplayNationality(value: string): string {
  return value.split(/\s+/).map(part => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}
