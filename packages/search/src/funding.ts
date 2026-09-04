import type { FundingClass } from "@scholarship-agent/shared";

export interface FundingEvidence {
  tuitionCovered?: boolean;
  stipendMentioned?: boolean;
  accommodationCovered?: boolean;
  travelCovered?: boolean;
  insuranceCovered?: boolean;
  text: string;
}

/** Conservative classifier: unknown funding never becomes a recommendation. */
export function classifyFunding(evidence: FundingEvidence): FundingClass {
  const text = evidence.text.toLowerCase();
  const fullLanguage = /fully funded|full funding|100% tuition/.test(text);
  const stipend = evidence.stipendMentioned || /stipend|living allowance|maintenance allowance/.test(text);
  const tuition = evidence.tuitionCovered ?? /tuition (fee )?waiver|full tuition|100% tuition/.test(text);
  const meaningfulSupport = stipend || evidence.accommodationCovered || evidence.travelCovered;

  if (fullLanguage && stipend && tuition) return "fully_funded";
  if (tuition && meaningfulSupport) return "substantially_funded";
  if (tuition || /partial scholarship|partial funding|tuition discount/.test(text)) return "partial";
  if (/self[- ]funded|no funding|unfunded/.test(text)) return "unfunded";
  return "unknown";
}

export function isFundedEnough(funding: FundingClass): boolean {
  return funding === "fully_funded" || funding === "substantially_funded";
}
