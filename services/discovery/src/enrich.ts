import type { ApplicantProfile } from "@scholarship-agent/shared";
import { assessEligibility, classifyFunding, type FundingEvidence } from "@scholarship-agent/search";
import type { DiscoveryRecord } from "./index";
import { deepExtractPage, type DeepExtractionResult } from "./deep-extract";
import { normalizeDiscoveryRecord, type NormalizedScholarship } from "./normalize";
import { verifySource, type VerificationResult } from "./verification";
import type { ExtractedRequirement } from "./requirements";

export interface EnrichedDiscoveryRecord { record:DiscoveryRecord; candidate:NormalizedScholarship; extraction?:DeepExtractionResult; verification?:VerificationResult; enrichmentError?:string; }
const MAX_ENRICH=40, CONCURRENCY=5, MAX_SECONDARY_RECORDS=24, MAX_SECONDARY_LINKS=3;
const LINK_TERMS=/funding|scholarship|studentship|stipend|tuition|eligib|requirement|admission|programme|program|research|supervisor|graduate|master|MSc|apply/i;

export async function enrichDiscoveryRecords(profile:ApplicantProfile,records:DiscoveryRecord[],limit=MAX_ENRICH):Promise<EnrichedDiscoveryRecord[]>{
 const selected=records.slice(0,Math.max(1,Math.min(limit,100)));const results:EnrichedDiscoveryRecord[]=new Array(selected.length);let cursor=0;
 async function worker(){while(true){const index=cursor++;if(index>=selected.length)return;const record=selected[index];try{
  let extraction=await deepExtractPage(record.url);
  if(index<MAX_SECONDARY_RECORDS) extraction=await expandExtraction(extraction);
  const enrichedRecord:DiscoveryRecord={...record,url:extraction.finalUrl||record.url,title:extraction.title||record.title,snippet:[record.snippet,extraction.text].filter(Boolean).join(" ").slice(0,30000)};
  const candidate=normalizeDiscoveryRecord(enrichedRecord);const funding:FundingEvidence={text:extraction.text,tuitionCovered:/full tuition|100% tuition|tuition (fee )?waiver|fees fully covered|fees covered in full|tuition and fees covered in full/i.test(extraction.text),stipendMentioned:/stipend|living allowance|maintenance allowance|monthly allowance|living costs covered|bursary|funding package/i.test(extraction.text),accommodationCovered:/accommodation|housing|residential costs/i.test(extraction.text),travelCovered:/travel (grant|allowance|costs)|flight|airfare|relocation/i.test(extraction.text),insuranceCovered:/health insurance|medical insurance/i.test(extraction.text)};
  const requirements:ScholarshipRequirement[]=extraction.requirements.map(item=>({name:item.name,required:item.required,category:item.category,details:item.details,conditional:item.conditional,sourceInstruction:item.sourceInstruction,evidence:item.evidence}));
  candidate.fundingClass=classifyFunding(funding);candidate.applicationUrl=extraction.applicationUrl??candidate.applicationUrl;candidate.deadline=parseDeadline(extraction.deadline)??candidate.deadline;candidate.requirements=requirements;candidate.eligibility={...candidate.eligibility,...extractEligibility(extraction.text)};candidate.evidence={...candidate.evidence,sourceUrl:extraction.finalUrl,funding,eligibility:candidate.eligibility,requirements,snippet:extraction.text.slice(0,8000)};
  const eligibility=assessEligibility(profile,candidate);const verification=await verifySource(extraction.finalUrl);if(verification.status==="suspicious")candidate.fundingClass="unknown";
  results[index]={record:enrichedRecord,candidate,extraction,verification,enrichmentError:eligibility.status==="not_eligible"?"Eligibility assessment found a hard exclusion":undefined};
 }catch(error){results[index]={record,candidate:normalizeDiscoveryRecord(record),enrichmentError:error instanceof Error?error.message:"Deep enrichment failed"};}}}
 await Promise.all(Array.from({length:Math.min(CONCURRENCY,selected.length)},()=>worker()));return results;
}

async function expandExtraction(primary:DeepExtractionResult):Promise<DeepExtractionResult>{
 const hostname=hostOf(primary.finalUrl);if(!hostname)return primary;
 const links=primary.links.filter(link=>hostOf(link.url)===hostname&&LINK_TERMS.test(`${link.label} ${link.url}`)).slice(0,MAX_SECONDARY_LINKS);
 if(!links.length)return primary;
 const secondary=await Promise.allSettled(links.map(link=>deepExtractPage(link.url)));
 const pages=secondary.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
 if(!pages.length)return primary;
 const allText=[primary.text,...pages.map(page=>page.text)].join(" ").slice(0,50000);
 const requirements=mergeRequirements(primary.requirements,pages.flatMap(page=>page.requirements));
 return {...primary,text:allText,applicationUrl:primary.applicationUrl??pages.map(page=>page.applicationUrl).find(Boolean),deadline:primary.deadline??pages.map(page=>page.deadline).find(Boolean),fundingEvidence:unique([...primary.fundingEvidence,...pages.flatMap(page=>page.fundingEvidence)]).slice(0,12),eligibilityEvidence:unique([...primary.eligibilityEvidence,...pages.flatMap(page=>page.eligibilityEvidence)]).slice(0,12),degreeEvidence:unique([...primary.degreeEvidence,...pages.flatMap(page=>page.degreeEvidence)]).slice(0,12),structuredEvidence:unique([...primary.structuredEvidence,...pages.flatMap(page=>page.structuredEvidence)]).slice(0,12),requirements,links:uniqueLinks([...primary.links,...pages.flatMap(page=>page.links)]).slice(0,80)};
}
function mergeRequirements(primary:ExtractedRequirement[],secondary:ExtractedRequirement[]):ExtractedRequirement[]{const seen=new Set<string>();return [...primary,...secondary].filter(item=>{const key=`${item.category}|${item.name.toLowerCase().trim()}`;if(seen.has(key))return false;seen.add(key);return true;});}
function uniqueLinks(items:Array<{label:string;url:string}>){const seen=new Set<string>();return items.filter(item=>{const key=item.url.replace(/#.*$/,"");if(seen.has(key))return false;seen.add(key);return true;});}
function unique(items:string[]){const seen=new Set<string>();return items.filter(item=>{const key=item.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});}
function hostOf(value:string):string|undefined{try{return new URL(value).hostname.toLowerCase().replace(/^www\./,"")}catch{return undefined}}
function extractEligibility(text:string){const lower=text.toLowerCase();const eligibleNationalities=/international students|all nationalities|any nationality/.test(lower)?["international"]:undefined;const excludedNationalities=/not open to international students|international students are not eligible|nigerian nationals are not eligible/.test(lower)?["international"]:undefined;return{internationalStudents:eligibleNationalities?true:excludedNationalities?false:undefined,eligibleNationalities,excludedNationalities};}
function parseDeadline(value?:string):string|undefined{if(!value)return undefined;const direct=new Date(value);if(!Number.isNaN(direct.getTime()))return direct.toISOString();const normalized=value.replace(/(\d{1,2})(st|nd|rd|th)/gi,"$1").replace(/\s+/g," ").trim();const parsed=new Date(normalized);return Number.isNaN(parsed.getTime())?undefined:parsed.toISOString();}
