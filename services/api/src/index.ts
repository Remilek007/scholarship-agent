import cors from "cors";
import express from "express";
import { createScholarshipRepository } from "@scholarship-agent/database";
import { buildDiscoveryQueries, scoreCandidate } from "@scholarship-agent/search";
import type { ApplicantProfile, ScholarshipCandidate, OpportunityType } from "@scholarship-agent/shared";
import { createDiscoveryEngine, verifySource } from "@scholarship-agent/discovery";
import { getEnabledSourceRegistry } from "@scholarship-agent/discovery/source-registry";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const repository = process.env.DATABASE_URL ? createScholarshipRepository(process.env.DATABASE_URL) : undefined;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/discovery/health", async (_req, res) => {
  try {
    const engine = createDiscoveryEngine();
    res.json(await engine.health());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Discovery health check failed" });
  }
});

app.get("/api/discovery/sources", (_req, res) => {
  res.json(getEnabledSourceRegistry());
});

app.post("/api/discovery/plan", (req, res) => {
  try {
    const profile = req.body.profile as ApplicantProfile;
    res.json({ queries: buildDiscoveryQueries(profile) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to build discovery plan" });
  }
});

app.post("/api/discovery/run", async (req, res) => {
  try {
    const profile = req.body.profile as ApplicantProfile;
    const engine = createDiscoveryEngine();
    const result = await engine.searchAndPersist(profile);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Discovery run failed" });
  }
});

app.post("/api/discovery/search", async (req, res) => {
  try {
    const profile = req.body.profile as ApplicantProfile;
    const queries = Array.isArray(req.body.queries) ? req.body.queries.filter((item: unknown): item is string => typeof item === "string") : undefined;
    const engine = createDiscoveryEngine();
    res.json(await engine.search(profile, queries));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Discovery search failed" });
  }
});

app.post("/api/matches", (req, res) => {
  const profile = req.body.profile as ApplicantProfile;
  const candidates = Array.isArray(req.body.candidates) ? req.body.candidates as ScholarshipCandidate[] : [];
  const matches = candidates.map((candidate) => ({ candidate, match: scoreCandidate(profile, candidate) }));
  res.json(matches);
});

app.get("/api/scholarships", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const fundingClass = typeof req.query.fundingClass === "string" && isFundingClass(req.query.fundingClass) ? req.query.fundingClass : undefined;
  const degreeLevel = typeof req.query.degreeLevel === "string" && isDegreeLevel(req.query.degreeLevel) ? req.query.degreeLevel : undefined;
  const opportunityType = typeof req.query.opportunityType === "string" && isOpportunityType(req.query.opportunityType) ? req.query.opportunityType : undefined;
  res.json(await repository.listScholarships({ fundingClass, degreeLevel, opportunityType }));
});

app.get("/api/scholarships/:id", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const scholarship = await repository.getScholarship(req.params.id);
  if (!scholarship) return res.status(404).json({ error: "Scholarship not found" });
  res.json(scholarship);
});

app.post("/api/scholarships/:id/verify", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const scholarship = await repository.getScholarship(req.params.id);
  if (!scholarship) return res.status(404).json({ error: "Scholarship not found" });
  const result = await verifySource(scholarship.sourceUrl);
  await repository.recordVerification(req.params.id, result);
  res.json(result);
});

app.post("/api/applications", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const scholarshipId = typeof req.body.scholarshipId === "string" ? req.body.scholarshipId : "";
  if (!scholarshipId) return res.status(400).json({ error: "scholarshipId is required" });
  const scholarship = await repository.getScholarship(scholarshipId);
  if (!scholarship) return res.status(404).json({ error: "Scholarship not found" });
  res.json(await repository.createApplication(scholarshipId));
});

app.get("/api/applications", async (_req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  res.json(await repository.listApplications());
});

app.get("/api/applications/:id", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const application = await repository.getApplication(req.params.id);
  if (!application) return res.status(404).json({ error: "Application not found" });
  res.json(application);
});

app.patch("/api/applications/:id", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const patch: { status?: string; aiPolicy?: string; notes?: string } = {};
  if (typeof req.body.status === "string") patch.status = req.body.status;
  const aiPolicy = parseAiPolicy(req.body.aiPolicy);
  if (aiPolicy) patch.aiPolicy = aiPolicy;
  if (typeof req.body.notes === "string") patch.notes = req.body.notes;
  const updated = await repository.updateApplication(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Application not found" });
  res.json(updated);
});

app.put("/api/applications/:id/requirements", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  if (!Array.isArray(req.body.requirements)) return res.status(400).json({ error: "requirements must be an array" });
  const requirements = req.body.requirements
    .filter((item: unknown): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item: Record<string, unknown>) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      required: item.required !== false,
      status: typeof item.status === "string" ? item.status : "missing",
      sourceInstruction: typeof item.sourceInstruction === "string" ? item.sourceInstruction : undefined
    }))
    .filter((item: { name: string }) => Boolean(item.name));
  res.json(await repository.replaceRequirements(req.params.id, requirements));
});

app.put("/api/applications/:id/answers", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const field = typeof req.body.field === "string" ? req.body.field.trim() : "";
  const answer = typeof req.body.answer === "string" ? req.body.answer : "";
  if (!field) return res.status(400).json({ error: "field is required" });
  res.json(await repository.upsertAnswer(req.params.id, field, answer, parseAiPolicy(req.body.aiPolicy) ?? "unknown", req.body.reviewed === true));
});

app.post("/api/applications/:id/events", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const eventType = typeof req.body.eventType === "string" ? req.body.eventType : "";
  if (!eventType) return res.status(400).json({ error: "eventType is required" });
  res.json(await repository.recordApplicationEvent(req.params.id, eventType, typeof req.body.details === "object" && req.body.details !== null ? req.body.details : {}));
});

app.post("/api/applications/:id/prepare", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  const application = await repository.getApplication(req.params.id);
  if (!application) return res.status(404).json({ error: "Application not found" });
  await repository.recordApplicationEvent(req.params.id, "preparation_started", { userRequested: true });
  res.json({ application, nextStep: "review_requirements", finalSubmissionRequiresUserApproval: true });
});

function parseOpportunityType(value: unknown): OpportunityType | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return isOpportunityType(value) ? value : undefined;
}

function parseAiPolicy(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return ["unknown", "allowed", "restricted", "prohibited"].includes(value) ? value : undefined;
}

function isOpportunityType(value: string | null | undefined): value is OpportunityType {
  return value === "scholarship" || value === "studentship" || value === "research_position" || value === "assistantship" || value === "fellowship" || value === "grant" || value === "other";
}

function isDegreeLevel(value: string | null | undefined): value is ScholarshipCandidate["degreeLevel"] {
  return value === "masters" || value === "phd" || value === "undergraduate" || value === "other";
}

function isFundingClass(value: string): value is ScholarshipCandidate["fundingClass"] {
  return value === "fully_funded" || value === "substantially_funded" || value === "partial" || value === "unfunded" || value === "unknown";
}

app.listen(port, () => console.log(`Scholarship Agent API listening on http://localhost:${port}`));
