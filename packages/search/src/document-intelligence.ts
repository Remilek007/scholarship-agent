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
  [/\bforest science\b/i, "Forest Science"],
  [/\bforest management\b/i, "Forest Management"],
  [/\bsilviculture\b/i, "Silviculture"],
  [/\bforest ecology\b/i, "Forest Ecology"],
  [/\btropical forestry\b/i, "Tropical Forestry"],
  [/\bwildlife\b/i, "Wildlife"],
  [/\bzoology\b/i, "Zoology"],
  [/\bconservation\b/i, "Conservation"],
  [/\bbiodiversity\b/i, "Biodiversity"],
  [/\bnatural resources?\b/i, "Natural Resources"],
  [/\becosystem management\b/i, "Ecosystem Management"],
  [/\bagroforestry\b/i, "Agroforestry"],
  [/\bcommunity forestry\b/i, "Community Forestry"],
  [/\bforest carbon\b/i, "Forest Carbon"],
  [/\bREDD\+?/i, "Forest Carbon / REDD+"],
  [/\bremote sensing\b/i, "Remote Sensing"],
  [/\bGIS\b|geographic information systems?/i, "Geospatial/GIS"],
  [/\bQGIS\b/i, "QGIS"],
  [/\bArcGIS\b/i, "ArcGIS"],
  [/\bclimate change\b/i, "Climate"],
  [/\bclimate adaptation\b/i, "Climate Adaptation"],
  [/\brestoration ecology\b/i, "Restoration Ecology"],
  [/\benvironmental management\b/i, "Environmental Management"],
  [/\benvironmental policy\b/i, "Environmental Policy"]
];

const SKILL_PATTERNS: Array<[RegExp, string]> = [
  [/\bQGIS\b/i, "QGIS"],
  [/\bArcGIS\b/i, "ArcGIS"],
  [/\bR programming\b|\bRStudio\b/i, "R / RStudio"],
  [/\bPython\b/i, "Python"],
  [/\bSPSS\b/i, "SPSS"],
  [/\bremote sensing\b/i, "Remote Sensing"],
  [/\bGPS\b/i, "GPS / Field Data"],
  [/\bdata analysis\b/i, "Data Analysis"]
];

export function analyzeApplicantDocument(text: string, hintedType?: DocumentAnalysis["documentType"]): DocumentAnalysis {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return {
      documentType: hintedType ?? "unknown",
      facts: [],
      suggestedProfilePatch: {},
      warnings: ["No document text was supplied."]
    };
  }

  const documentType = hintedType ?? detectDocumentType(normalized);
  const facts: DocumentFact[] = [];
  const add = (field: DocumentFact["field"], value: string | undefined, confidence: number, evidence: string) => {
    if (value?.trim()) facts.push({ field, value: value.trim(), confidence, evidence: evidence.trim().slice(0, 360) });
  };

  const cgpa = normalized.match(/(?:CGPA|GPA|C\.G\.P\.A\.?)\D{0,30}(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/i);
  if (cgpa) {
    add("academicScore", cgpa[1], 0.96, cgpa[0]);
    if (cgpa[2]) add("academicScale", cgpa[2], 0.96, cgpa[0]);
  }

  const degree = normalized.match(/\b(B\.?Sc\.?|B\.?S\.?|Bachelor(?:'s)?|M\.?Sc\.?|M\.?S\.?|Master(?:'s)?)\s+(?:of\s+)?([A-Za-z][A-Za-z0-9 &/,-]{2,90})/i);
  if (degree) {
    add("highestQualification", `${degree[1]} ${degree[2]}`.replace(/\s+/g, " "), 0.86, degree[0]);
    add("degreeField", degree[2], 0.82, degree[0]);
  }

  const fields = unique(FIELD_PATTERNS.filter(([pattern]) => pattern.test(normalized)).map(([, value]) => value));
  if (fields.length) add("targetFields", fields.join(", "), 0.84, fields.join(", "));

  const experience = extractSection(normalized, ["work experience", "professional experience", "employment", "experience"], ["education", "skills", "technical skills", "projects", "research", "publications", "certifications", "awards"]);
  if (experience) add("workExperience", experience, 0.75, experience);

  const skills = unique(SKILL_PATTERNS.filter(([pattern]) => pattern.test(normalized)).map(([, value]) => value));
  if (skills.length) {
    facts.push({
      field: "workExperience",
      value: `Technical skills: ${skills.join(", ")}`,
      confidence: 0.82,
      evidence: skills.join(", ")
    });
  }

  const suggestedProfilePatch: Partial<ApplicantProfile> = {};
  for (const fact of facts) {
    if (fact.field === "academicScore") suggestedProfilePatch.academicScore = Number(fact.value);
    if (fact.field === "academicScale") suggestedProfilePatch.academicScale = Number(fact.value);
    if (fact.field === "highestQualification") suggestedProfilePatch.highestQualification = fact.value;
    if (fact.field === "degreeField") suggestedProfilePatch.degreeField = fact.value;
    if (fact.field === "targetFields") suggestedProfilePatch.targetFields = fact.value.split(", ");
    if (fact.field === "workExperience" && !suggestedProfilePatch.workExperience) suggestedProfilePatch.workExperience = fact.value;
  }

  return {
    documentType,
    facts,
    suggestedProfilePatch,
    warnings: [
      "Review every extracted fact before saving it to your profile.",
      "Only explicit document evidence is used; nationality, achievements, referees, research claims and other unsupported facts are never invented."
    ]
  };
}

function extractSection(text: string, starts: string[], ends: string[]): string | undefined {
  const startTerms = starts.map(escapeRegex).join("|");
  const endTerms = ends.map(escapeRegex).join("|");
  const start = new RegExp(`(?:${startTerms})[:\\s]+`, "i").exec(text);
  if (!start) return undefined;
  const rest = text.slice(start.index + start[0].length);
  const end = new RegExp(`\\s(?:${endTerms})[:\\s]`, "i").exec(rest);
  return rest.slice(0, end ? end.index : 600).trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectDocumentType(text: string): DocumentAnalysis["documentType"] {
  const lower = text.toLowerCase();
  if (/transcript|semester|course code|credit unit|grade point/.test(lower)) return "transcript";
  if (/curriculum vitae|professional experience|work experience|education|skills/.test(lower)) return "cv";
  if (/personal statement|statement of purpose|motivation letter/.test(lower)) return "statement";
  return "unknown";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
