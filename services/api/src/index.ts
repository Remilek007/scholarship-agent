import cors from "cors";
import express from "express";
import { createScholarshipRepository } from "@scholarship-agent/database";
import { createDiscoveryEngine, extractApplicationRequirements, normalizeDiscoveryRecords, verifySource } from "@scholarship-agent/discovery";
import { applicantProfileSchema } from "@scholarship-agent/schemas";
import { buildDiscoveryQueries, scoreCandidate } from "@scholarship-agent/search";
import type { OpportunityType, ScholarshipCandidate } from "@scholarship-agent/shared";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const discovery = createDiscoveryEngine();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "scholarship-agent-api" }));

app.get("/api/discovery/health", async (_req, res) => {
  try { return res.json({ sources: await discovery.health() }); }
  catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" }); }
});

app.post("/api/discovery/plan", (req, res) => {
  const parsed = applicantProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid applicant profile", details: parsed.error.flatten() });
  const queries = buildDiscoveryQueries(parsed.data);
  return res.json({ mode: "explore", queryCount: queries.length, queries });
});

app.post("/api/discovery/run", async (req, res) => {
  const parsed = applicantProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid applicant profile", details: parsed.error.flatten() });
  try {
    const records = await discovery.search(parsed.data);
    const scholarships = normalizeDiscoveryRecords(records);
    const persistence = req.query.persist === "false" ? undefined : await discovery.persist(records);
    return res.json({ mode: "explore", recordCount: records.length, scholarshipCount: scholarships.length, records, scholarships, persistence });
  } catch (error) { return res.status(500).json({ error: "Discovery run failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.post("/api/discovery/search", async (req, res) => {
  const parsed = applicantProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid applicant profile", details: parsed.error.flatten() });
  try {
    const records = await discovery.search(parsed.data);
    const scholarships = normalizeDiscoveryRecords(records);
    const persistence = req.query.persist === "false" ? undefined : await discovery.persist(records);
    return res.json({ recordCount: records.length, scholarshipCount: scholarships.length, records, scholarships, persistence });
  } catch (error) { return res.status(500).json({ error: "Discovery search failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.post("/api/scholarships/:id/verify", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const repository = createScholarshipRepository();
    const scholarship = await repository.getScholarship(req.params.id);
    if (!scholarship) return res.status(404).json({ error: "Scholarship not found" });
    const sourceUrl = typeof req.body?.sourceUrl === "string" && req.body.sourceUrl ? req.body.sourceUrl : scholarship.sourceUrl;
    const verification = await verifySource(sourceUrl);
    const updated = await repository.recordVerification(scholarship.id, verification);
    return res.json({ verification, scholarship: updated });
  } catch (error) { return res.status(500).json({ error: "Source verification failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.post("/api/matches", async (req, res) => {
  const parsed = applicantProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid applicant profile", details: parsed.error.flatten() });
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const limit = parseLimit(req.query.limit, 10, 20);
    const includeReview = req.query.includeReview === "true";
    const minTrustLevel = parseTrustLevel(req.query.minTrustLevel, 1);
    if (minTrustLevel === null) return res.status(400).json({ error: "minTrustLevel must be an integer from 1 to 5" });
    const opportunityType = parseOpportunityType(req.query.opportunityType);
    if (req.query.opportunityType && !opportunityType) return res.status(400).json({ error: "Invalid opportunityType" });
    const repository = createScholarshipRepository();
    const rows = await repository.listScholarships({ degreeLevel: parsed.data.degreeLevel, minTrustLevel, opportunityType, limit: 200 });
    const evidenceById = await repository.getLatestEligibilityEvidence(rows.map((row) => row.id));
    const scored = rows.map((row) => {
      const candidate: ScholarshipCandidate = {
        title: row.title, provider: row.provider ?? undefined, university: row.university ?? undefined,
        country: row.country ?? undefined, degreeLevel: row.degreeLevel as ScholarshipCandidate["degreeLevel"],
        opportunityType: row.opportunityType as OpportunityType, fields: row.fields, sourceUrl: row.sourceUrl,
        applicationUrl: row.applicationUrl ?? undefined, fundingClass: row.fundingClass as ScholarshipCandidate["fundingClass"],
        deadline: row.deadline?.toISOString(), eligibility: evidenceById.get(row.id)
      };
      return { ...row, match: scoreCandidate(parsed.data, candidate) };
    }).filter((item: { match: ReturnType<typeof scoreCandidate> }) => item.match.eligibility !== "not_eligible").sort((a, b) => b.match.overallScore - a.match.overallScore).slice(0, limit);
    return res.json({ matches: scored.map((item: { match: ReturnType<typeof scoreCandidate> }) => includeReview ? item : { ...item, match: { ...item.match, reasons: undefined } }) });
  } catch (error) { return res.status(500).json({ error: "Matching failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.get("/api/scholarships", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const repository = createScholarshipRepository();
    const minTrustLevel = parseTrustLevel(req.query.minTrustLevel, 1);
    if (minTrustLevel === null) return res.status(400).json({ error: "minTrustLevel must be an integer from 1 to 5" });
    const opportunityType = parseOpportunityType(req.query.opportunityType);
    if (req.query.opportunityType && !opportunityType) return res.status(400).json({ error: "Invalid opportunityType" });
    const scholarships = await repository.listScholarships({
      fundingClass: typeof req.query.fundingClass === "string" ? req.query.fundingClass : undefined,
      degreeLevel: typeof req.query.degreeLevel === "string" ? req.query.degreeLevel : undefined,
      country: typeof req.query.country === "string" ? req.query.country : undefined,
      opportunityType,
      minTrustLevel,
      limit: parseLimit(req.query.limit, 50, 200)
    });
    return res.json({ scholarships });
  } catch (error) { return res.status(500).json({ error: "Scholarship listing failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.get("/api/scholarships/:id", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const repository = createScholarshipRepository();
    const scholarship = await repository.getScholarship(req.params.id);
    if (!scholarship) return res.status(404).json({ error: "Scholarship not found" });
    return res.json({ scholarship });
  } catch (error) { return res.status(500).json({ error: "Scholarship load failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.get("/api/applications", async (_req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try { return res.json({ applications: await createScholarshipRepository().listApplications() }); }
  catch (error) { return res.status(500).json({ error: "Application listing failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.post("/api/applications", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  const scholarshipId = typeof req.body?.scholarshipId === "string" ? req.body.scholarshipId : "";
  const aiPolicy = parseAiPolicy(req.body?.aiPolicy ?? "unknown");
  if (!scholarshipId) return res.status(400).json({ error: "scholarshipId is required" });
  if (!aiPolicy) return res.status(400).json({ error: "Invalid aiPolicy" });
  try {
    const repository = createScholarshipRepository();
    if (!(await repository.getScholarship(scholarshipId))) return res.status(404).json({ error: "Scholarship not found" });
    const application = await repository.createApplication(scholarshipId, aiPolicy, typeof req.body?.notes === "string" ? req.body.notes : undefined);
    return res.status(201).json({ application });
  } catch (error) { return res.status(500).json({ error: "Application creation failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.get("/api/applications/:id", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const application = await createScholarshipRepository().getApplication(req.params.id);
    if (!application) return res.status(404).json({ error: "Application not found" });
    return res.json({ application });
  } catch (error) { return res.status(500).json({ error: "Application load failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.post("/api/applications/:id/prepare", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const repository = createScholarshipRepository();
    const application = await repository.getApplication(req.params.id);
    if (!application) return res.status(404).json({ error: "Application not found" });
    const scholarship = await repository.getScholarship(application.scholarshipId);
    if (!scholarship) return res.status(404).json({ error: "Scholarship not found" });
    const sourceUrl = scholarship.applicationUrl ?? scholarship.sourceUrl;
    const response = await fetch(sourceUrl, { headers: { "user-agent": "ScholarshipAgent/0.1 (+application-preparation)" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return res.status(502).json({ error: "Application source could not be fetched", status: response.status, sourceUrl });
    const html = await response.text();
    const requirements = extractApplicationRequirements(html);
    const prepared = await repository.replaceRequirements(req.params.id, requirements);
    await repository.recordApplicationEvent(req.params.id, "requirements_extracted", { sourceUrl: response.url || sourceUrl, count: requirements.length });
    return res.json({ application: prepared, sourceUrl: response.url || sourceUrl, requirementCount: requirements.length });
  } catch (error) { return res.status(500).json({ error: "Application preparation failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.patch("/api/applications/:id", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  const status = typeof req.body?.status === "string" ? req.body.status : undefined;
  const aiPolicy = req.body?.aiPolicy === undefined ? undefined : parseAiPolicy(req.body.aiPolicy);
  if (req.body?.aiPolicy !== undefined && !aiPolicy) return res.status(400).json({ error: "Invalid aiPolicy" });
  try {
    const repository = createScholarshipRepository();
    const application = await repository.updateApplication(req.params.id, { status, aiPolicy, notes: typeof req.body?.notes === "string" ? req.body.notes : undefined });
    if (!application) return res.status(404).json({ error: "Application not found" });
    return res.json({ application });
  } catch (error) { return res.status(500).json({ error: "Application update failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.put("/api/applications/:id/requirements", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  if (!Array.isArray(req.body?.requirements)) return res.status(400).json({ error: "requirements must be an array" });
  const requirements = req.body.requirements
    .filter((item: unknown): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item: Record<string, unknown>) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      required: item.required !== false,
      status: typeof item.status === "string" ? item.status : "missing",
      sourceInstruction: typeof item.sourceInstruction === "string" ? item.sourceInstruction : undefined
    }))
    .filter((item) => item.name);
  try {
    const repository = createScholarshipRepository();
    if (!(await repository.getApplication(req.params.id))) return res.status(404).json({ error: "Application not found" });
    const application = await repository.replaceRequirements(req.params.id, requirements);
    return res.json({ application });
  } catch (error) { return res.status(500).json({ error: "Requirement update failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.put("/api/applications/:id/answers", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  const field = typeof req.body?.field === "string" ? req.body.field.trim() : "";
  const answer = typeof req.body?.answer === "string" ? req.body.answer : "";
  const aiPolicy = parseAiPolicy(req.body?.aiPolicy ?? "unknown");
  if (!field || !answer) return res.status(400).json({ error: "field and answer are required" });
  if (!aiPolicy) return res.status(400).json({ error: "Invalid aiPolicy" });
  try {
    const repository = createScholarshipRepository();
    if (!(await repository.getApplication(req.params.id))) return res.status(404).json({ error: "Application not found" });
    const saved = await repository.upsertAnswer(req.params.id, field, answer, aiPolicy, req.body?.reviewed === true);
    return res.json({ answer: saved });
  } catch (error) { return res.status(500).json({ error: "Answer save failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.post("/api/applications/:id/events", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  const eventType = typeof req.body?.eventType === "string" ? req.body.eventType.trim() : "";
  if (!eventType) return res.status(400).json({ error: "eventType is required" });
  try {
    const repository = createScholarshipRepository();
    if (!(await repository.getApplication(req.params.id))) return res.status(404).json({ error: "Application not found" });
    const details = typeof req.body?.details === "object" && req.body.details !== null ? req.body.details as Record<string, unknown> : {};
    const event = await repository.recordApplicationEvent(req.params.id, eventType, details);
    return res.status(201).json({ event });
  } catch (error) { return res.status(500).json({ error: "Application event failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "string" || !value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseTrustLevel(value: unknown, fallback: number): number | null {
  if (typeof value !== "string" || !value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

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
