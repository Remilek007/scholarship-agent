import cors from "cors";
import express from "express";
import { applicantProfileSchema } from "@scholarship-agent/schemas";
import { buildDiscoveryQueries } from "@scholarship-agent/search";
import { createDiscoveryEngine } from "../../discovery/src/factory";
import { normalizeDiscoveryRecords } from "../../discovery/src/normalize";

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

  const records = await discovery.search(parsed.data);
  const scholarships = normalizeDiscoveryRecords(records);
  return res.json({ recordCount: records.length, scholarshipCount: scholarships.length, records, scholarships });
});

app.listen(port, () => {
  console.log(`Scholarship Agent API listening on http://localhost:${port}`);
});
