# Scholarship Analyst

A Forestry-first scholarship discovery and intelligence workspace for finding funded Master's opportunities worldwide and understanding whether they fit an applicant profile.

## Product mode

This project is intentionally **analysis-only**. It does not prepare applications, generate factual application answers, fill forms, upload documents, submit applications, or act as the applicant.

The workflow is:

```text
Applicant profile / CV
        ↓
Federated discovery (SearXNG + official registries + RSS/API providers)
        ↓
Canonicalization + multi-source deduplication
        ↓
Deep page extraction + optional Playwright rendering for JS-heavy pages
        ↓
Funding + deadline + eligibility evidence
        ↓
Field / academic / profile matching
        ↓
Requirement extraction + source verification
        ↓
Ranked scholarship intelligence + diagnostics
        ↓
Applicant opens the official source and applies manually
```

## Discovery architecture

The discovery service is deliberately provider-neutral. It can combine:

- **SearXNG** for broad multi-engine web discovery when `SEARXNG_URL` is configured.
- The existing Brave, Tavily, generic-search and RSS adapters.
- An official-source registry covering government scholarship programmes, international organisations, research ecosystems and scholarship directories.
- Sitemap discovery plus bounded same-domain crawling for registry seeds.
- Deep HTML/JSON-LD extraction for application links, deadlines, funding evidence, eligibility evidence and requirements.
- Optional Playwright rendering for JavaScript-heavy pages when `DISCOVERY_PLAYWRIGHT_ENABLED=true`.
- Canonical URL normalization that removes tracking parameters while preserving the original discovered URL.
- Candidate deduplication before enrichment and persistence.
- Per-run diagnostics for queries, source health, provider failures, raw/unique records, enrichment and verification.

### SearXNG setup

Set the following environment variables for broad web discovery:

```text
SEARXNG_URL=http://localhost:8080
SEARXNG_ENGINES=google,bing,brave,duckduckgo
```

If `SEARXNG_URL` is empty, the system continues using the other configured discovery providers and the official source registry.

### Discovery controls

```text
DISCOVERY_MAX_PAGES=250
DISCOVERY_MAX_DEPTH=3
DISCOVERY_CONCURRENCY=6
DISCOVERY_REQUEST_TIMEOUT_MS=20000
DISCOVERY_PLAYWRIGHT_ENABLED=false
```

These bounds keep discovery from turning into an unbounded crawler. Increase them gradually on a deployment with sufficient resources.

When Playwright is enabled, the crawler reserves part of the page budget for browser fallback and deep extraction can render a likely JavaScript shell before extracting content. The application remains non-fatal if browser startup fails: it falls back to the original HTTP response. For actual JS rendering, the deployment must also have a compatible Playwright browser binary installed.

For a Playwright-enabled deployment, install the browser required by the installed Playwright version during the image/build setup, for example:

```text
pnpm exec playwright install chromium
```

If the deployment does not need JS rendering, leave `DISCOVERY_PLAYWRIGHT_ENABLED=false` and no browser binary is required by the discovery workflow.

## What the system analyzes

For each opportunity, the dashboard is designed to surface:

- Degree level and opportunity type
- Field/discipline relevance
- Nationality and international-applicant eligibility
- Academic minimums and academic-scale requirements when captured
- Funding classification
- Tuition coverage
- Stipend information
- Accommodation, travel and insurance coverage
- Application deadline
- Required and optional application documents
- Special instructions and conditions
- Supervisor/research requirements when captured
- Language requirements when captured by the source
- Official source and application links
- Source trust level and verification evidence
- A match score against the applicant profile
- Items that still need manual confirmation from the official source

## Applicant document intelligence

The CV/document analyzer remains useful for discovery and matching. It extracts supported facts such as degree, CGPA, academic field, technical skills and research/work evidence so the search can become more precise. Extracted facts are presented for review before being used in the search profile.

It does **not** create application answers or submit anything.

## API discovery endpoints

- `GET /api/discovery/health` — source health overview.
- `GET /api/discovery/status` — scheduler state.
- `GET /api/discovery/sources` — enabled registry sources.
- `POST /api/discovery/plan` — generate the expanded query plan for a profile.
- `POST /api/discovery/search` — run federated discovery and return diagnostics.
- `POST /api/discovery/run` — discover, enrich, deduplicate and persist opportunities.
- `POST /api/discovery/run-scheduled` — execute the configured scheduled profile.

## Manual application boundary

When a scholarship is selected, the system provides an analysis panel and links to the official source. The applicant is responsible for reading the current rules, preparing their own documents and answers, completing the form, and submitting the application.

The old application workspace/database structures may remain temporarily for backward compatibility, but they are no longer part of the product workflow.
