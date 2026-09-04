export type DegreeLevel = "masters" | "phd" | "undergraduate" | "other";

export type FundingClass = "fully_funded" | "substantially_funded" | "partial" | "unfunded" | "unknown";

export type EligibilityStatus = "confirmed_eligible" | "probably_eligible" | "cannot_determine" | "not_eligible";

export type OpportunityType = "scholarship" | "studentship" | "research_position" | "assistantship" | "fellowship" | "grant" | "other";

export type ApplicationStatus = "discovered" | "review" | "preparing" | "ready" | "submitted" | "withdrawn";

export type ApplicationEventType = "created" | "status_changed" | "document_attached" | "draft_saved" | "review_requested" | "submission_approved" | "submitted";

export interface ApplicantProfile {
  nationality: string;
  degreeLevel: DegreeLevel;
  targetFields: string[];
  minimumFunding: "substantial" | "full";
  academicScore?: number;
  academicScale?: number;
}

export interface ScholarshipEligibilityEvidence {
  internationalStudents?: boolean;
  eligibleNationalities?: string[];
  excludedNationalities?: string[];
  minimumAcademicScore?: number;
  academicScale?: number;
  text?: string;
}

export interface ScholarshipCandidate {
  title: string;
  provider?: string;
  university?: string;
  country?: string;
  degreeLevel?: DegreeLevel;
  opportunityType?: OpportunityType;
  fields: string[];
  sourceUrl: string;
  applicationUrl?: string;
  fundingClass: FundingClass;
  deadline?: string;
  eligibility?: ScholarshipEligibilityEvidence;
}

export interface MatchResult {
  eligibility: EligibilityStatus;
  fieldScore: number;
  fundingScore: number;
  academicScore: number;
  profileScore: number;
  deadlineScore: number;
  confidence: number;
  overallScore: number;
  reasons: string[];
}

export interface ApplicationWorkspace {
  id: string;
  scholarshipId: string;
  status: ApplicationStatus;
  aiPolicy?: "allowed" | "limited" | "prohibited" | "unknown";
  notes?: string;
}

export interface ApplicationRequirement {
  id: string;
  applicationId: string;
  name: string;
  required: boolean;
  status: "missing" | "ready" | "attached" | "waived";
  sourceInstruction?: string;
}

export interface ApplicationAnswer {
  id: string;
  applicationId: string;
  field: string;
  answer: string;
  aiPolicy: "allowed" | "limited" | "prohibited" | "unknown";
  reviewed: boolean;
}
