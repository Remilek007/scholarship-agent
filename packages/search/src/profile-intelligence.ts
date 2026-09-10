import type { ApplicantEvidence, ApplicantIntelligence, ApplicantProfile, OpportunityType } from "@scholarship-agent/shared";

const FIELD_GROUPS: Array<[string, RegExp[]]> = [
  ["Forestry", [/\bforestry\b/i, /forest science/i, /forest management/i, /silviculture/i, /forest ecology/i, /tropical forestry/i]],
  ["Wildlife", [/\bwildlife\b/i, /wildlife management/i, /wildlife ecology/i, /zoology/i]],
  ["Conservation", [/conservation/i, /biodiversity/i, /ecosystem management/i, /restoration ecology/i]],
  ["Natural Resources", [/natural resources?/i, /land management/i, /environmental management/i]],
  ["Climate", [/climate change/i, /forest carbon/i, /REDD\+?/i, /climate adaptation/i, /climate mitigation/i]],
  ["Geospatial", [/\bGIS\b/i, /geographic information systems?/i, /remote sensing/i, /geospatial/i]],
  ["Agroforestry", [/agroforestry/i, /community forestry/i, /forest livelihood/i]],
  ["Environmental Policy", [/environmental policy/i, /forest policy/i, /natural resource policy/i]]
];

const SKILLS: Array<[string, RegExp]> = [
  ["QGIS", /\bQGIS\b/i], ["ArcGIS", /\bArcGIS\b/i], ["Remote Sensing", /remote sensing/i],
  ["GIS", /\bGIS\b|geographic information systems?/i], ["GPS", /\bGPS\b/i], ["Python", /\bPython\b/i],
  ["R / RStudio", /\bRStudio\b|\bR programming\b/i], ["SPSS", /\bSPSS\b/i],
  ["Data Analysis", /data analysis|statistical analysis/i], ["Field Research", /field research|fieldwork|field work/i]
];

const OPPORTUNITY_PATTERNS: Array<[OpportunityType, RegExp]> = [
  ["research_position", /research position|graduate research|research project/i],
  ["studentship", /studentship|funded MSc|funded master's/i],
  ["assistantship", /research assistantship|graduate assistantship/i],
  ["scholarship", /scholarship|fellowship funding/i],
  ["fellowship", /fellowship/i]
];

export function buildApplicantIntelligence(profile: ApplicantProfile): ApplicantIntelligence {
  const text = [profile.degreeField, profile.highestQualification, profile.workExperience, profile.researchExperience, ...(profile.targetFields ?? []), ...(profile.researchInterests ?? []), ...(profile.technicalSkills ?? [])].filter(Boolean).join(" ");
  const evidence: ApplicantEvidence[] = [];
  const normalizedFields = unique([...profile.targetFields, ...detectGroups(text)]);
  const researchThemes = unique([...(profile.researchInterests ?? []), ...detectGroups(profile.researchExperience ?? "")]);
  const skills = unique([...(profile.technicalSkills ?? []), ...detectSkills(text)]);
  const opportunityTypes = uniqueOpportunityTypes([...(profile.preferredOpportunityTypes ?? []), ...detectOpportunityTypes(text)]);

  for (const field of normalizedFields) evidence.push({ field: "field", value: field, confidence: profile.targetFields.includes(field) ? 1 : 0.82, source: profile.targetFields.includes(field) ? "profile" : "inferred" });
  for (const skill of skills) evidence.push({ field: "skill", value: skill, confidence: profile.technicalSkills?.includes(skill) ? 1 : 0.82, source: profile.technicalSkills?.includes(skill) ? "profile" : "inferred" });
  if (profile.degreeField) evidence.push({ field: "degreeField", value: profile.degreeField, confidence: 1, source: "profile" });
  if (profile.academicScore !== undefined) evidence.push({ field: "academicScore", value: `${profile.academicScore}/${profile.academicScale ?? "?"}`, confidence: 1, source: "profile" });
  if (profile.researchExperience) evidence.push({ field: "researchExperience", value: profile.researchExperience.slice(0, 500), confidence: 1, source: "profile" });

  const searchTerms = unique([
    ...normalizedFields,
    ...researchThemes,
    ...skills,
    profile.degreeLevel === "masters" ? "MSc" : profile.degreeLevel,
    "fully funded", "studentship", "graduate research position", "funded thesis", "international students"
  ]).slice(0, 40);

  const completeness = completenessScore(profile, normalizedFields, researchThemes, skills);
  return { normalizedFields, researchThemes, skills, opportunityTypes, evidence, searchTerms, completeness };
}

function detectGroups(text: string): string[] { return FIELD_GROUPS.filter(([, patterns]) => patterns.some(pattern => pattern.test(text))).map(([name]) => name); }
function detectSkills(text: string): string[] { return SKILLS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name); }
function detectOpportunityTypes(text: string): OpportunityType[] { return OPPORTUNITY_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([type]) => type); }
function unique(values: string[]): string[] { return [...new Set(values.map(value => value.trim()).filter(Boolean))]; }
function uniqueOpportunityTypes(values: OpportunityType[]): OpportunityType[] { return [...new Set(values)]; }

function completenessScore(profile: ApplicantProfile, fields: string[], themes: string[], skills: string[]): number {
  const checks = [Boolean(profile.nationality), Boolean(profile.degreeLevel), fields.length > 0, profile.academicScore !== undefined, themes.length > 0, skills.length > 0, Boolean(profile.workExperience || profile.researchExperience), (profile.countriesOfInterest?.length ?? 0) > 0];
  return Number((checks.filter(Boolean).length / checks.length).toFixed(2));
}
