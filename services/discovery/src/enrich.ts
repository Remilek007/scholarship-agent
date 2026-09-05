import type { ApplicantProfile } from "@scholarship-agent/shared";
import { assessEligibility, classifyFunding, type FundingEvidence } from "@scholarship-agent/search";
import type { DiscoveryRecord } from "./index";
import { deepExtractPage, type DeepExtractionResult } from "./deep-extract";
import { normalizeDiscoveryRecord, type NormalizedScholarship } from "./normalize";
import { verifySource, type VerificationResult } from "./verification";

export interface EnrichedDiscoveryRecord {
  record: DiscoveryRecord;
  candidate: NormalizedScholarship;
  extraction?: DeepExtractionResult;
  verification?: VerificationResult;
  enrichmentError?: string;
}

const MAX_ENRICH = 40;
const CONCURRENCY = 5;

export async function enrichDiscoveryRecords(
  profile: ApplicantProfile,
  records: DiscoveryRecord[],
  limit = MAX_ENRICH
): Promise<EnrichedDiscoveryRecord[]> {
  const selected = records.slice(0, Math.max(1, Math.min(limit, MAX_ENRICH)));
  const results: EnrichedDiscoveryRecord[] = new Array(selected.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= selected.length) return;
      const record = selected[index];
      try {
        const extraction = await deepExtractPage(record.url);
        const enrichedRecord: DiscoveryRecord = {
          ...record,
          url: extraction.finalUrl || record.url,
          title: extraction.title || record.title,
          snippet: [record.snippet, extraction.text].filter(Boolean).join(" ").slice(0, 30_000)
        };
        const candidate = normalizeDiscoveryRecord(enrichedRecord);
        const funding: FundingEvidence = {
          text: extraction.text,
          tuitionCovered: /full tuition|100% tuition|tuition (fee )?waiver|fees fully covered|fees covered in full|tuition and fees covered in full/i.test(extraction.text),
          stipendMentioned: /stipend|living allowance|maintenance allowance|monthly allowance|living costs covered|bursary|funding package/i.test(extraction.text),
          accommodationCovered: /accommodation|housing|residential costs/i.test(extraction.text),
          travelCovered: /travel (grant|allowance|costs)|flight|airfare|relocation/i.test(extraction.text),
          insuranceCovered: /health insurance|medical insurance/i.test(extraction.text)
        };
        const requirements = extraction.requirements.map((item) => ({
          name: item.name,
          required: item.required,
          sourceInstruction: item.sourceInstruction
        }));
        candidate.fundingClass = classifyFunding(funding);
        candidate.applicationUrl = extraction.applicationUrl ?? candidate.applicationUrl;
        candidate.deadline = parseDeadline(extraction.deadline) ?? candidate.deadline;
        candidate.requirements = requirements;
        candidate.eligibility = {
          ...candidate.eligibility,
          ...extractEligibility(extraction.text)
        };
        candidate.evidence = {
          ...candidate.evidence,
          sourceUrl: extraction.finalUrl,
          funding,
          eligibility: candidate.eligibility,
          requirements,
          snippet: extraction.text.slice(0, 8_000)
        };
        const eligibility = assessEligibility(profile, candidate);
        const verification = await verifySource(extraction.finalUrl);
        if (verification.status === "suspicious") candidate.fundingClass = "unknown";
        results[index] = { record: enrichedRecord, candidate, extraction, verification, enrichmentError: eligibility.status === "not_eligible" ? "Eligibility assessment found a hard exclusion" : undefined };
      } catch (error) {
        results[index] = {
          record,
          candidate: normalizeDiscoveryRecord(record),
          enrichmentError: error instanceof Error ? error.message : "Deep enrichment failed"
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, selected.length) }, () => worker()));
  return results;
}

function extractEligibility(text: string) {
  const lower = text.toLowerCase();
  const eligibleNationalities = /international students|all nationalities|any nationality/.test(lower) ? ["international"] : undefined;
  const excludedNationalities = /not open to international students|international students are not eligible|nigerian nationals are not eligible/.test(lower) ? ["international"] : undefined;
  return { internationalStudents: eligibleNationalities ? true : excludedNationalities ? false : undefined, eligibleNationalities, excludedNationalities };
}

function parseDeadline(value?: string): string | undefined {
  if (!value) return undefined;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  const normalized = value.replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1").replace(/\s+/g, " ").trim();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
