import type { ApplicantProfile } from "@scholarship-agent/shared";

export interface DocumentFact {
  field: "highestQualification" | "degreeField" | "academicScore" | "academicScale" | "targetFields" | "workExperience";
  value: string;
  confidence: number;
  evidence: string;
}

export interface DocumentAnalysis {
  documentType: "cv" | "transcript" | "statement" | "unknown";
  facts: DocumentFact[];
  suggestedProfilePatch: Partial<ApplicantProfile>;
  warnings: string[];
}

const FIELD_PATTERNS: Array<[RegExp, string]> = [
  [/\bforestry\b/i, "Forestry"],
  [/\bwildlife\b/i, "Wildlife"],
  [/\bconservation\b/i, "Conservation"],
  [/\bnatural resources?\b/i, "Natural Resources"],
  [/\bclimate change\b/i, "Climate"],
  [/\bremote sensing\b/i, "Remote Sensing"],
  [/\bGIS\b|geographic information systems?/i, "Geospatial/GIS"]
];

export function analyzeApplicantDocument(text: string, hintedType?: DocumentAnalysis["documentType"]): DocumentAnalysis {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return { documentType: hintedType ?? "unknown", facts: [], suggestedProfilePatch: {}, warnings: ["No document text was supplied."] };

  const documentType = hintedType ?? detectDocumentType(normalized);
  const facts: DocumentFact[] = [];
  const add = (field: DocumentFact["field"], value: string | undefined, confidence: number, evidence: string) => {
    if (value?.trim()) facts.push({ field, value: value.trim(), confidence, evidence: evidence.trim().slice(0, 300) });
  };

  const cgpa = normalized.match(/(?:CGPA|GPA|C\.G\.P\.A\.?)[^\d]{0,20}(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/i);
  if (cgpa) add("academicScore", cgpa[1], 0.96, cgpa[0]);
  if (cgpa?.[2]) add("academicScale", cgpa[2], 0.96, cgpa[0]);

  const degree = normalized.match(/\b(B\.?Sc\.?|B\.?S\.?|Bachelor(?:'s)?|M\.?Sc\.?|M\.?S\.?|Master(?:'s)?)\s+(?:of\s+)?([A-Za-z][A-Za-z &/-]{2,80})/i);
  if (degree) {
    add("highestQualification", `${degree[1]} ${degree[2]}`.replace(/\s+/g, " "), 0.86, degree[0]);
    add("degreeField", degree[2], 0.82, degree[0]);
  }

  const fields = unique(FIELD_PATTERNS.filter(([pattern]) => pattern.test(normalized)).map(([, value]) => value));
  if (fields.length) add("targetFields", fields.join(", "), 0.78, fields.join(", "));

  const experience = normalized.match(/(?:work experience|professional experience|employment|experience)[:\s]+(.{20,500}?)(?=\s(?:education|skills|projects|research|certifications)\b|$)/i);
  if (experience) add("workExperience", experience[1], 0.72, experience[0]);

  const suggestedProfilePatch: Partial<ApplicantProfile> = {};
  for (const fact of facts) {
    if (fact.field === "academicScore") suggestedProfilePatch.academicScore = Number(fact.value);
    if (fact.field === "academicScale") suggestedProfilePatch.academicScale = Number(fact.value);
    if (fact.field === "highestQualification") suggestedProfilePatch.highestQualification = fact.value;
    if (fact.field === "degreeField") suggestedProfilePatch.degreeField = fact.value;
    if (fact.field === "targetFields") suggestedProfilePatch.targetFields = fact.value.split(", ");
    if (fact.field === "workExperience") suggestedProfilePatch.workExperience = fact.value;
  }

  return {
    documentType,
    facts,
    suggestedProfilePatch,
    warnings: [
      "Document extraction is evidence-assisted, not authoritative: review every suggested fact before saving it to the profile.",
      "This analyzer does not infer nationality, achievements, referees, research claims, or other facts that are not explicitly present."
    ]
  };
}

function detectDocumentType(text: string): DocumentAnalysis["documentType"] {
  const lower = text.toLowerCase();
  if (/transcript|semester|course code|credit unit|grade point/.test(lower)) return "transcript";
  if (/curriculum vitae|professional experience|work experience|education|skills/.test(lower)) return "cv";
  if (/personal statement|statement of purpose|motivation letter/.test(lower)) return "statement";
  return "unknown";
}

function unique(values: string[]): string[] { return [...new Set(values)]; }
