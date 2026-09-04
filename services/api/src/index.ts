import cors from "cors";
import express from "express";
import { createScholarshipRepository } from "@scholarship-agent/database";
import { createDiscoveryEngine, normalizeDiscoveryRecords, verifySource } from "@scholarship-agent/discovery";
import { applicantProfileSchema } from "@scholarship-agent/schemas";
import { buildDiscoveryQueries, scoreCandidate } from "@scholarship-agent/search";
import type { ScholarshipCandidate } from "@scholarship-agent/shared";

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
    const repository = createScholarshipRepository();
    const rows = await repository.listScholarships({ degreeLevel: parsed.data.degreeLevel, minTrustLevel, limit: 200 });
    const evidenceById = await repository.getLatestEligibilityEvidence(rows.map((row) => row.id));
    const scored = rows.map((row) => {
      const candidate: ScholarshipCandidate = {
        title: row.title, provider: row.provider ?? undefined, university: row.university ?? undefined,
        country: row.country ?? undefined, degreeLevel: isDegreeLevel(row.degreeLevel) ? row.degreeLevel : undefined,
        fields: Array.isArray(row.fields) ? row.fields : [], sourceUrl: row.sourceUrl,
        applicationUrl: row.applicationUrl ?? undefined, fundingClass: isFundingClass(row.fundingClass) ? row.fundingClass : "unknown",
        deadline: row.deadline?.toISOString(), eligibility: evidenceById.get(row.id)
      };
      const match = scoreCandidate(parsed.data, candidate);
      return { ...candidate, id: row.id, trustLevel: row.trustLevel, score: Math.round(match.overallScore * 100), ...match };
    }).filter((item) => item.eligibility !== "not_eligible" && (includeReview || item.eligibility !== "cannot_determine"))
      .sort((a, b) => b.score - a.score).slice(0, limit);
    return res.json({ mode: "apply", count: scored.length, profile: parsed.data, matches: scored });
  } catch (error) { return res.status(500).json({ error: "Match calculation failed", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.get("/api/scholarships", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const repository = createScholarshipRepository();
    const minTrustLevel = req.query.minTrustLevel ? Number(req.query.minTrustLevel) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    if (minTrustLevel !== undefined && (!Number.isInteger(minTrustLevel) || minTrustLevel < 1 || minTrustLevel > 5)) return res.status(400).json({ error: "minTrustLevel must be an integer from 1 to 5" });
    const scholarships = await repository.listScholarships({ fundingClass: typeof req.query.fundingClass === "string" ? req.query.fundingClass : undefined, degreeLevel: typeof req.query.degreeLevel === "string" ? req.query.degreeLevel : undefined, country: typeof req.query.country === "string" ? req.query.country : undefined, minTrustLevel, limit });
    return res.json({ count: scholarships.length, scholarships });
  } catch (error) { return res.status(500).json({ error: "Failed to load scholarships", details: error instanceof Error ? error.message : "Unknown error" }); }
});

app.get("/api/scholarships/:id", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    const repository = createScholarshipRepository();
    const scholarship = await repository.getScholarship(req.params.id);
    if (!scholarship) return res.status(404).json({ error: "Scholarship not found" });
    return res.json({ scholarship });
  } catch (error) { return res.status(500).json({ error: "Failed to load scholarship", details: error instanceof Error ? error.message : "Unknown error" }); }
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

function isDegreeLevel(value: string | null): value is ScholarshipCandidate["degreeLevel"] {
  return value === "masters" || value === "phd" || value === "undergraduate" || value === "other";
}

function isFundingClass(value: string): value is ScholarshipCandidate["fundingClass"] {
  return value === "fully_funded" || value === "substantially_funded" || value === "partial" || value === "unfunded" || value === "unknown";
}

app.listen(port, () => console.log(`Scholarship Agent API listening on http://localhost:${port}`));
