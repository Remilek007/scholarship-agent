import assert from "node:assert/strict";
import test from "node:test";
import { classifyFunding, isFundedEnough } from "./funding.ts";

test("classifies explicit full funding", () => {
  const funding = classifyFunding({ tuitionCovered: true, stipendMentioned: true, text: "Fully funded scholarship with full tuition and a monthly stipend." });
  assert.equal(funding, "fully_funded");
});

test("rejects partial funding for a substantial minimum", () => {
  const funding = classifyFunding({ tuitionCovered: true, stipendMentioned: false, text: "Tuition fee waiver available." });
  assert.equal(funding, "partial");
  assert.equal(isFundedEnough(funding, "substantial"), false);
});

test("classifies explicit self-funded exclusions as unfunded", () => {
  const funding = classifyFunding({ tuitionCovered: true, stipendMentioned: false, text: "Tuition fee waiver available; living costs are self-funded." });
  assert.equal(funding, "unfunded");
});

test("requires full funding when applicant minimum is full", () => {
  assert.equal(isFundedEnough("substantially_funded", "full"), false);
  assert.equal(isFundedEnough("fully_funded", "full"), true);
});
