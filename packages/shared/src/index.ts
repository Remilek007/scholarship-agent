export type DegreeLevel = "masters" | "phd" | "undergraduate" | "other";

export type FundingClass = "fully_funded" | "substantially_funded" | "partial" | "unfunded" | "unknown";

export type EligibilityStatus = "confirmed_eligible" | "probably_eligible" | "cannot_determine" | "not_eligible";

export interface ApplicantProfile {
  nationality: string;
  degreeLevel: DegreeLevel;
  targetFields: string[];
  minimumFunding: "substantial" | "full";
  academicScore?: number;
  academicScale?: number;
}

export interface ScholarshipCandidate {
  title: string;
  provider?: string;
  university?: string;
  country?: string;
  degreeLevel?: DegreeLevel;
  fields: string[];
  sourceUrl: string;
  applicationUrl?: string;
  fundingClass: FundingClass;
  deadline?: string;
}

export interface MatchResult {
  eligibility: EligibilityStatus;
  fieldScore: number;
  fundingScore: number;
  academicScore: number;
  overallScore: number;
  reasons: string[];
}
