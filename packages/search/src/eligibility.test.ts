import assert from "node:assert/strict";
import test from "node:test";
import { assessEligibility, extractEligibilityEvidence } from "./eligibility";

test("extracts international eligibility evidence without applicant-specific country rules", () => {
  const evidence = extractEligibilityEvidence("International applicants are eligible. Minimum GPA: 3.0/4.0.");
  assert.equal(evidence.internationalStudents, true);
  assert.equal(evidence.minimumAcademicScore, 3);
  assert.equal(evidence.academicScale, 4);
});

test("hard-excludes an explicitly excluded applicant nationality", () => {
  const profile = {
    nationality: "Nigeria",
    degreeLevel: "masters" as const,
    targetFields: ["forestry"],
    minimumFunding: "full" as const,
    academicScore: 4.5,
    academicScale: 5
  };
  const candidate = {
    title: "Forestry MSc Scholarship",
    provider: "Example University",
    country: "Canada",
    degreeLevel: "masters" as const,
    fields: ["forestry"],
    sourceUrl: "https://example.edu/scholarship",
    fundingClass: "fully_funded" as const,
    eligibility: {
      internationalStudents: false,
      excludedNationalities: ["Nigeria"],
      text: "International applicants are not eligible."
    }
  };
  const result = assessEligibility(profile, candidate);
  assert.equal(result.status, "not_eligible");
});

test("does not compare academic scores across unknown scales", () => {
  const profile = {
    nationality: "Nigeria",
    degreeLevel: "masters" as const,
    targetFields: ["forestry"],
    minimumFunding: "full" as const,
    academicScore: 4.5,
    academicScale: 5
  };
  const candidate = {
    title: "Forestry MSc Scholarship",
    provider: "Example University",
    country: "Canada",
    degreeLevel: "masters" as const,
    fields: ["forestry"],
    sourceUrl: "https://example.edu/scholarship",
    fundingClass: "fully_funded" as const,
    eligibility: {
      internationalStudents: true,
      minimumAcademicScore: 70,
      text: "International applicants are eligible. Minimum academic score: 70 percent."
    }
  };
  const result = assessEligibility(profile, candidate);
  assert.notEqual(result.status, "not_eligible");
});
