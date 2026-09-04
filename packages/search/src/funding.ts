import type { FundingClass } from "@scholarship-agent/shared";

export interface FundingEvidence {
  tuitionCovered?: boolean;
  stipendMentioned?: boolean;
  accommodationCovered?: boolean;
  travelCovered?: boolean;
  insuranceCovered?: boolean;
  text: string;
}

/**
 * Classify only from concrete funding language. Unknown/partial funding is
 * intentionally excluded from the funded recommendation pool.
 */
export function classifyFunding(evidence: FundingEvidence): FundingClass {
  const text = evidence.text.toLowerCase();
  const explicitFull = /fully funded|fully-funded|full funding|funded in full|all expenses covered|all costs covered/.test(text);
  const tuition = evidence.tuitionCovered ?? /full tuition|100% tuition|tuition (fee )?waiver|fees fully covered|fees covered in full|tuition and fees covered/.test(text);
  const stipend = evidence.stipendMentioned ?? /stipend|living allowance|maintenance allowance|monthly allowance|living costs covered/.test(text);
  const accommodation = evidence.accommodationCovered ?? /accommodation|housing|residential costs/.test(text);
  const travel = evidence.travelCovered ?? /travel (grant|allowance|costs)|flight|airfare|relocation/.test(text);
  const insurance = evidence.insuranceCovered ?? /health insurance|medical insurance/.test(text);
  const meaningfulSupport = stipend || accommodation || travel;
  const partial = /partial scholarship|partial funding|partial tuition|tuition discount|up to \d+%/.test(text);
  const exclusions = /self[- ]funded|no funding|unfunded|funding not available/.test(text);

  if (exclusions && !explicitFull) return "unfunded";
  if (partial && !explicitFull && !(/100%|full tuition|fees covered in full/.test(text))) return "partial";

  // Explicit full-funding language is sufficient when the page describes the
  // award as covering the complete study/living package. A stipend or tuition
  // signal raises confidence but should not be required redundantly.
  if (explicitFull && (tuition || stipend || accommodation || travel || insurance)) return "fully_funded";
  if (tuition && meaningfulSupport) return "substantially_funded";
  if (tuition) return "partial";
  return "unknown";
}

export function isFundedEnough(funding: FundingClass): boolean {
  return funding === "fully_funded" || funding === "substantially_funded";
}
