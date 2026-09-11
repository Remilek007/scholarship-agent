import type { ApplicantProfile } from "@scholarship-agent/shared";

export interface DocumentFact {
  field: "highestQualification" | "degreeField" | "academicScore" | "academicScale" | "targetFields" | "workExperience" | "researchExperience" | "researchInterests" | "technicalSkills";
  value: string;
  confidence: number;
  evidence: string;
}
export interface DocumentAnalysis { documentType:"cv"|"transcript"|"statement"|"unknown"; facts:DocumentFact[]; suggestedProfilePatch:Partial<ApplicantProfile>; warnings:string[]; }

const FIELD_PATTERNS:Array<[RegExp,string]>=[
 [/\bforestry\b/i,"Forestry"],[/forest science/i,"Forest Science"],[/forest management/i,"Forest Management"],[/silviculture/i,"Silviculture"],[/forest ecology/i,"Forest Ecology"],[/tropical forestry/i,"Tropical Forestry"],[/wildlife/i,"Wildlife"],[/zoology/i,"Zoology"],[/conservation/i,"Conservation"],[/biodiversity/i,"Biodiversity"],[/natural resources?/i,"Natural Resources"],[/ecosystem management/i,"Ecosystem Management"],[/agroforestry/i,"Agroforestry"],[/community forestry/i,"Community Forestry"],[/forest carbon/i,"Forest Carbon"],[/REDD\+?/i,"Forest Carbon / REDD+"],[/remote sensing/i,"Remote Sensing"],[/\bGIS\b|geographic information systems?/i,"Geospatial/GIS"],[/climate change/i,"Climate"],[/climate adaptation/i,"Climate Adaptation"],[/restoration ecology/i,"Restoration Ecology"],[/environmental management/i,"Environmental Management"],[/environmental policy/i,"Environmental Policy"]
];
const SKILL_PATTERNS:Array<[RegExp,string]>=[[/\bQGIS\b/i,"QGIS"],[/\bArcGIS\b/i,"ArcGIS"],[/\bR programming\b|\bRStudio\b/i,"R / RStudio"],[/\bPython\b/i,"Python"],[/\bSPSS\b/i,"SPSS"],[/remote sensing/i,"Remote Sensing"],[/\bGPS\b/i,"GPS / Field Data"],[/data analysis|statistical analysis/i,"Data Analysis"]];

export function analyzeApplicantDocument(text:string,hintedType?:DocumentAnalysis["documentType"]):DocumentAnalysis{
 const normalized=text.replace(/\s+/g," ").trim();
 if(!normalized)return{documentType:hintedType??"unknown",facts:[],suggestedProfilePatch:{},warnings:["No document text was supplied."]};
 const documentType=hintedType??detectDocumentType(normalized);const facts:DocumentFact[]=[];
 const add=(field:DocumentFact["field"],value:string|undefined,confidence:number,evidence:string)=>{if(value?.trim())facts.push({field,value:value.trim(),confidence,evidence:evidence.trim().slice(0,500)});};
 const cgpa=normalized.match(/(?:CGPA|GPA|C\.G\.P\.A\.?)\D{0,30}(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/i);
 if(cgpa){add("academicScore",cgpa[1],0.96,cgpa[0]);if(cgpa[2])add("academicScale",cgpa[2],0.96,cgpa[0]);}
 const degree=normalized.match(/\b(B\.?Sc\.?|B\.?S\.?|Bachelor(?:'s)?|M\.?Sc\.?|M\.?S\.?|Master(?:'s)?)\s+(?:of\s+)?([A-Za-z][A-Za-z0-9 &/,-]{2,90})/i);
 if(degree){add("highestQualification",`${degree[1]} ${degree[2]}`.replace(/\s+/g," "),0.86,degree[0]);add("degreeField",degree[2],0.82,degree[0]);}
 const fields=unique(FIELD_PATTERNS.filter(([pattern])=>pattern.test(normalized)).map(([,value])=>value));if(fields.length)add("targetFields",fields.join(", "),0.84,fields.join(", "));
 const experience=extractSection(normalized,["work experience","professional experience","employment","experience"],["education","skills","technical skills","projects","research","publications","certifications","awards"]);if(experience)add("workExperience",experience,0.78,experience);
 const research=extractSection(normalized,["research experience","research projects","research background","thesis","dissertation"],["education","work experience","professional experience","skills","publications","certifications"]);if(research)add("researchExperience",research,0.86,research);
 const interests=extractSection(normalized,["research interests","areas of interest","research areas","interests"],["education","experience","skills","research experience","publications","certifications"]);if(interests)add("researchInterests",interests,0.80,interests);
 const skills=unique(SKILL_PATTERNS.filter(([pattern])=>pattern.test(normalized)).map(([,value])=>value));if(skills.length)add("technicalSkills",skills.join(", "),0.88,skills.join(", "));
 const suggestedProfilePatch:Partial<ApplicantProfile>={};
 for(const fact of facts){
  if(fact.field==="academicScore")suggestedProfilePatch.academicScore=Number(fact.value);
  if(fact.field==="academicScale")suggestedProfilePatch.academicScale=Number(fact.value);
  if(fact.field==="highestQualification")suggestedProfilePatch.highestQualification=fact.value;
  if(fact.field==="degreeField")suggestedProfilePatch.degreeField=fact.value;
  if(fact.field==="targetFields")suggestedProfilePatch.targetFields=fact.value.split(", ");
  if(fact.field==="workExperience")suggestedProfilePatch.workExperience=fact.value;
  if(fact.field==="researchExperience")suggestedProfilePatch.researchExperience=fact.value;
  if(fact.field==="researchInterests")suggestedProfilePatch.researchInterests=fact.value.split(/[,;|]/).map(v=>v.trim()).filter(Boolean).slice(0,20);
  if(fact.field==="technicalSkills")suggestedProfilePatch.technicalSkills=fact.value.split(", ").filter(Boolean);
 }
 return{documentType,facts,suggestedProfilePatch,warnings:["Review every extracted fact before saving it to your profile.","Document evidence is separated from inference. Unsupported nationality, achievements, publications, referees, research claims or other facts are never invented.","Research interests and technical skills improve discovery and matching but do not establish eligibility by themselves."]};
}
function extractSection(text:string,starts:string[],ends:string[]):string|undefined{const startTerms=starts.map(escapeRegex).join("|");const endTerms=ends.map(escapeRegex).join("|");const start=new RegExp(`(?:${startTerms})[:\\s]+`,"i").exec(text);if(!start)return undefined;const rest=text.slice(start.index+start[0].length);const end=new RegExp(`\\s(?:${endTerms})[:\\s]`,"i").exec(rest);return rest.slice(0,end?end.index:900).trim();}
function escapeRegex(value:string):string{return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function detectDocumentType(text:string):DocumentAnalysis["documentType"]{const lower=text.toLowerCase();if(/transcript|semester|course code|credit unit|grade point/.test(lower))return"transcript";if(/curriculum vitae|professional experience|work experience|education|skills/.test(lower))return"cv";if(/personal statement|statement of purpose|motivation letter/.test(lower))return"statement";return"unknown";}
function unique(values:string[]):string[]{return[...new Set(values)];}
