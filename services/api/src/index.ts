import cors from "cors";
import express from "express";
import { createScholarshipRepository } from "@scholarship-agent/database";
import { createDiscoveryEngine, normalizeDiscoveryRecords } from "@scholarship-agent/discovery";
import { applicantProfileSchema } from "@scholarship-agent/schemas";
import { buildDiscoveryQueries } from "@scholarship-agent/search";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const discovery = createDiscoveryEngine();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "scholarship-agent-api" });
});

app.post("/api/discovery/plan", (req, res) => {
  const parsed = applicantProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid applicant profile", details: parsed.error.flatten() });
  }

  const queries = buildDiscoveryQueries(parsed.data);
  return res.json({ mode: "explore", queryCount: queries.length, queries });
});

app.post("/api/discovery/search", async (req, res) => {
  const parsed = applicantProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid applicant profile", details: parsed.error.flatten() });
  }

  try {
    const records = await discovery.search(parsed.data);
    const scholarships = normalizeDiscoveryRecords(records);
    const persist = req.query.persist !== "false";
    const persistence = persist ? await discovery.searchAndPersist(parsed.data) : undefined;

    return res.json({
      recordCount: records.length,
      scholarshipCount: scholarships.length,
      records,
      scholarships,
      persistence: persistence?.persistence
    });
  } catch (error) {
    return res.status(500).json({ error: "Discovery search failed", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/scholarships", async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL is not configured" });
  }

  try {
    const repository = createScholarshipRepository();
    const minTrustLevel = req.query.minTrustLevel ? Number(req.query.minTrustLevel) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    if (minTrustLevel !== undefined && (!Number.isInteger(minTrustLevel) || minTrustLevel < 1 || minTrustLevel > 5)) {
      return res.status(400).json({ error: "minTrustLevel must be an integer from 1 to 5" });
    }

    const scholarships = await repository.listScholarships({
      fundingClass: typeof req.query.fundingClass === "string" ? req.query.fundingClass : undefined,
      degreeLevel: typeof req.query.degreeLevel === "string" ? req.query.degreeLevel : undefined,
      country: typeof req.query.country === "string" ? req.query.country : undefined,
      minTrustLevel,
      limit
    });

    return res.json({ count: scholarships.length, scholarships });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load scholarships", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`Scholarship Agent API listening on http://localhost:${port}`);
});
