import cors from "cors";
import express from "express";
import { createScholarshipRepository } from "@scholarship-agent/database";
import { analyzeApplicantDocument, buildDiscoveryQueries, prepareApplicationIntelligence, rankCandidates, scoreCandidate } from "@scholarship-agent/search";
import type { ApplicantProfile, ScholarshipCandidate, OpportunityType } from "@scholarship-agent/shared";
import { createDiscoveryEngine, createDiscoveryScheduler, getEnabledSourceRegistry, readScheduledProfile, verifySource } from "@scholarship-agent/discovery";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const repository = process.env.DATABASE_URL ? createScholarshipRepository(process.env.DATABASE_URL) : undefined;
const scheduledProfile = readScheduledProfile();
const scheduler = scheduledProfile ? createDiscoveryScheduler(scheduledProfile) : undefined;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, databaseConfigured: Boolean(repository), schedulerEnabled: Boolean(scheduler?.status().enabled) }));

app.get("/api/discovery/health", async (_req, res) => {
  try { res.json(await createDiscoveryEngine().health()); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Discovery health check failed" }); }
});

app.get("/api/discovery/status", (_req, res) => res.json({ scheduler: scheduler?.status() ?? { enabled: false, running: false, intervalMinutes: null, reason: "DISCOVERY_PROFILE_JSON is not configured" } }));

app.post("/api/discovery/run-scheduled", async (_req, res) => {
  if (!scheduler) return res.status(503).json({ error: "Scheduled discovery is not configured. Set DISCOVERY_PROFILE_JSON and DISCOVERY_INTERVAL_MINUTES." });
  try { res.json(await scheduler.run()); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Scheduled discovery failed" }); }
});

app.get("/api/discovery/sources", (_req, res) => res.json(getEnabledSourceRegistry()));

app.post("/api/discovery/plan", (req, res) => {
  try { res.json({ queries: buildDiscoveryQueries(req.body.profile as ApplicantProfile) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to build discovery plan" }); }
});

app.post("/api/discovery/run", async (req, res) => {
  try {
    const profile = req.body.profile as ApplicantProfile;
    if (!profile?.nationality || !profile?.degreeLevel || !Array.isArray(profile?.targetFields)) return res.status(400).json({ error: "A complete applicant profile is required" });
    const deepEnrich = req.body.deepEnrich !== false;
    const limit = typeof req.body.limit === "number" ? Math.floor(req.body.limit) : undefined;
    res.json(await createDiscoveryEngine().searchAndPersist(profile, { deepEnrich, limit }));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Discovery run failed" }); }
});

app.post("/api/discovery/search", async (req, res) => {
  try {
    const profile = req.body.profile as ApplicantProfile;
    const queries = Array.isArray(req.body.queries) ? req.body.queries.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0) : undefined;
    res.json(await createDiscoveryEngine().searchWithDiagnostics(profile, queries));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Discovery search failed" }); }
});

app.post("/api/documents/analyze", (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text : "";
  const documentType = req.body.documentType === "cv" || req.body.documentType === "transcript" || req.body.documentType === "statement" || req.body.documentType === "unknown" ? req.body.documentType : undefined;
  if (!text.trim()) return res.status(400).json({ error: "text is required" });
  res.json(analyzeApplicantDocument(text, documentType));
});

app.post("/api/matches", (req, res) => {
  const profile = req.body.profile as ApplicantProfile;
  const candidates = Array.isArray(req.body.candidates) ? req.body.candidates as ScholarshipCandidate[] : [];
  res.json(candidates.map((candidate) => ({ candidate, match: scoreCandidate(profile, candidate) })));
});

app.post("/api/matches/top", async (req, res) => {
  if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" });
  try {
    const profile = req.body.profile as ApplicantProfile;
    const limit = typeof req.body.limit === "number" ? Math.min(Math.max(Math.floor(req.body.limit), 1), 20) : 10;
    const rows = await repository.listScholarships({ degreeLevel: "masters", limit: 200 });
    const candidates: ScholarshipCandidate[] = rows.map((row) => ({ title: row.title, provider: row.provider ?? undefined, university: row.university ?? undefined, country: row.country ?? undefined, degreeLevel: isDegreeLevel(row.degreeLevel) ? row.degreeLevel : undefined, opportunityType: isOpportunityType(row.opportunityType) ? row.opportunityType : undefined, fields: Array.isArray(row.fields) ? row.fields : [], sourceUrl: row.sourceUrl, applicationUrl: row.applicationUrl ?? undefined, fundingClass: isFundingClass(row.fundingClass) ? row.fundingClass : "unknown", deadline: row.deadline ? row.deadline.toISOString() : undefined }));
    // Keep reviewable opportunities visible. A missing eligibility fact is not the same as being ineligible.
    const ranked = rankCandidates(profile, candidates).filter((candidate) => candidate.eligibilityGate !== "fail").slice(0, limit);
    res.json({ profile, count: ranked.length, qualifyingCount: ranked.filter((candidate) => candidate.eligibilityGate === "pass").length, reviewCount: ranked.filter((candidate) => candidate.eligibilityGate === "review").length, matches: ranked });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to rank scholarship matches" }); }
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

app.get("/api/applications", async (_req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); res.json(await repository.listApplications()); });
app.get("/api/applications/:id", async (req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); const application = await repository.getApplication(req.params.id); if (!application) return res.status(404).json({ error: "Application not found" }); res.json(application); });
app.patch("/api/applications/:id", async (req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); const patch: { status?: string; aiPolicy?: string; notes?: string } = {}; if (typeof req.body.status === "string") patch.status = req.body.status; const aiPolicy = parseAiPolicy(req.body.aiPolicy); if (aiPolicy) patch.aiPolicy = aiPolicy; if (typeof req.body.notes === "string") patch.notes = req.body.notes; const updated = await repository.updateApplication(req.params.id, patch); if (!updated) return res.status(404).json({ error: "Application not found" }); res.json(updated); });
app.put("/api/applications/:id/requirements", async (req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); if (!Array.isArray(req.body.requirements)) return res.status(400).json({ error: "requirements must be an array" }); const requirements = req.body.requirements.filter((item: unknown): item is Record<string, unknown> => typeof item === "object" && item !== null).map((item: Record<string, unknown>) => ({ name: typeof item.name === "string" ? item.name.trim() : "", required: item.required !== false, status: typeof item.status === "string" ? item.status : "missing", sourceInstruction: typeof item.sourceInstruction === "string" ? item.sourceInstruction : undefined })).filter((item: { name: string }) => Boolean(item.name)); res.json(await repository.replaceRequirements(req.params.id, requirements)); });
app.patch("/api/applications/:id/requirements/:requirementId", async (req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); const status = parseRequirementStatus(req.body.status); if (!status) return res.status(400).json({ error: "status must be missing, ready, attached, or waived" }); const application = await repository.getApplication(req.params.id); if (!application) return res.status(404).json({ error: "Application not found" }); if (!application.requirements.some((item: { id: string }) => item.id === req.params.requirementId)) return res.status(404).json({ error: "Requirement not found" }); const updated = await repository.updateRequirementStatus(req.params.requirementId, status); if (!updated) return res.status(404).json({ error: "Requirement not found" }); res.json(updated); });
app.put("/api/applications/:id/answers", async (req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); const field = typeof req.body.field === "string" ? req.body.field.trim() : ""; const answer = typeof req.body.answer === "string" ? req.body.answer : ""; if (!field) return res.status(400).json({ error: "field is required" }); res.json(await repository.upsertAnswer(req.params.id, field, answer, parseAiPolicy(req.body.aiPolicy) ?? "unknown", req.body.reviewed === true)); });
app.post("/api/applications/:id/events", async (req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); const eventType = typeof req.body.eventType === "string" ? req.body.eventType : ""; if (!eventType) return res.status(400).json({ error: "eventType is required" }); res.json(await repository.recordApplicationEvent(req.params.id, eventType, typeof req.body.details === "object" && req.body.details !== null ? req.body.details : {})); });
app.post("/api/applications/:id/prepare", async (req, res) => { if (!repository) return res.status(503).json({ error: "DATABASE_URL not configured" }); const application = await repository.getApplication(req.params.id); if (!application) return res.status(404).json({ error: "Application not found" }); const profile = req.body.profile as ApplicantProfile | undefined; if (!profile?.nationality || !profile.degreeLevel || !Array.isArray(profile.targetFields)) return res.status(400).json({ error: "A complete applicant profile is required for preparation" }); const preparation = prepareApplicationIntelligence(profile, application); for (const answer of preparation.factualAnswers) await repository.upsertAnswer(application.id, answer.field, answer.answer, answer.aiPolicy, false); const updated = await repository.getApplication(application.id); res.json({ application: updated, preparation }); });

function isDegreeLevel(value: unknown): value is "bachelors" | "masters" | "phd" { return value === "bachelors" || value === "masters" || value === "phd"; }
function isFundingClass(value: unknown): value is "fully_funded" | "substantially_funded" | "partial" | "unfunded" | "unknown" { return value === "fully_funded" || value === "substantially_funded" || value === "partial" || value === "unfunded" || value === "unknown"; }
function isOpportunityType(value: unknown): value is OpportunityType { return value === "scholarship" || value === "studentship" || value === "research_position" || value === "assistantship" || value === "fellowship" || value === "grant" || value === "other"; }
function parseAiPolicy(value: unknown): "limited" | "assisted" | "unknown" | undefined { return value === "limited" || value === "assisted" || value === "unknown" ? value : undefined; }
function parseRequirementStatus(value: unknown): "missing" | "ready" | "attached" | "waived" | undefined { return value === "missing" || value === "ready" || value === "attached" || value === "waived" ? value : undefined; }

app.listen(port, () => console.log(`Scholarship Agent API listening on ${port}`));
