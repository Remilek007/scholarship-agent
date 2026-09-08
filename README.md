# Scholarship Agent

Forestry-first scholarship discovery and application assistant for funded Master's opportunities worldwide.

## Current pipeline

`query planning → multi-provider discovery → registry crawl → deduplication → structured/deep page extraction → funding classification → eligibility assessment → source verification → PostgreSQL persistence → strict ranking → application requirements → document-assisted profile intelligence → factual answer preparation → human review`

The system is intentionally free-first and provider-neutral. Search adapters can be swapped without changing the scholarship pipeline.

## Forestry focus

The search taxonomy prioritizes Forestry, Forest Science, Forest Management, Silviculture, Forest Ecology, Tropical Forestry, Wildlife Conservation, Conservation Biology, Biodiversity, Natural Resource Management, Agroforestry, Forest Carbon/REDD+, GIS and Remote Sensing, while also discovering interdisciplinary climate and conservation opportunities.

## Discovery

Discovery combines configured direct pages and RSS feeds with optional web-search providers and a maintained registry of government, university, international, foundation and research sources. Registry crawling runs once per discovery cycle and follows relevant same-domain scholarship, funding, Master's and research links.

Deep extraction now reads HTML metadata, canonical URLs, JSON-LD structured data, application links, deadlines and evidence snippets in addition to visible page text. Malformed structured data is non-fatal. Aggregators are treated as discovery sources; authoritative opportunity pages are verified before they qualify.

## Verification and ranking

- Funding is classified from evidence rather than provider labels alone.
- Fully funded and substantially funded opportunities qualify; partial and unfunded opportunities are excluded from the strict qualifying pool.
- Eligibility is a gate rather than something a high relevance score can compensate for.
- Unknown eligibility remains review-only instead of being silently treated as eligible.
- Source verification records redirects, official-domain signals, opportunity language and scam/payment warnings.
- Research positions, studentships and assistantships are first-class opportunity types.
- Duplicate opportunities are collapsed using title/provider/country identity with stronger evidence preferred.

## Application intelligence

The application workspace provides:

- extracted application requirements and readiness tracking
- manual requirement controls: missing, ready, attached, waived
- profile-grounded factual answer preparation
- explicit prompts for missing personal, research, career, achievement, English-evidence and referee information
- editable prepared answers with provenance
- application event history
- document-assisted profile extraction from supplied CV/transcript/statement text
- user-controlled final review and submission

Document intelligence is deliberately conservative: it can suggest facts explicitly found in a supplied document, but it does not invent nationality, achievements, research claims, referees or experience. Suggested profile changes must be reviewed before being saved.

## Scheduling

The API includes an optional built-in scheduler. Set `DISCOVERY_INTERVAL_MINUTES` to a positive value and `DISCOVERY_PROFILE_JSON` to a JSON-encoded applicant profile. The scheduler prevents overlapping runs and exposes status through `GET /api/discovery/status`. It is disabled by default.

## Workspace

- `apps/` — web dashboard and application workspace
- `services/api/` — Express API
- `services/discovery/` — discovery, deep extraction, verification, scheduling and persistence orchestration
- `packages/search/` — query generation, search providers, funding classification, eligibility, ranking, application and document intelligence
- `packages/database/` — PostgreSQL/Drizzle schema and repository
- `packages/schemas/` — request validation
- `packages/shared/` — shared domain types
- `config/search/forestry.json` — Forestry/Wildlife/Conservation taxonomy

## Important API endpoints

- `GET /health`
- `GET /api/discovery/health`
- `GET /api/discovery/status`
- `GET /api/discovery/sources`
- `POST /api/discovery/plan`
- `POST /api/discovery/search`
- `POST /api/discovery/run` — deep enrichment is enabled by default
- `POST /api/discovery/run-scheduled` — execute the configured scheduler profile immediately
- `POST /api/documents/analyze` — analyze supplied document text and return reviewable profile facts
- `POST /api/matches`
- `POST /api/matches/top`
- `GET /api/scholarships`
- `GET /api/scholarships/:id`
- `POST /api/scholarships/:id/verify`
- `POST /api/applications`
- `GET /api/applications`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id`
- `PATCH /api/applications/:id/requirements/:requirementId`
- `PUT /api/applications/:id/answers`
- `POST /api/applications/:id/prepare`
- `POST /api/applications/:id/events`

## Environment

Copy `.env.example` to `.env` and configure PostgreSQL.

Optional search credentials:

- `TAVILY_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `DISCOVERY_SEARCH_ENDPOINT` + `DISCOVERY_SEARCH_API_KEY`
- `DISCOVERY_RSS_FEEDS`
- `DISCOVERY_DIRECT_URLS`

Optional scheduling:

- `DISCOVERY_INTERVAL_MINUTES=0` disables the scheduler
- `DISCOVERY_PROFILE_JSON` supplies the profile used by scheduled discovery

Credentials and API keys must stay in environment variables and must never be committed.

## Safety boundary

The application assistant prepares evidence, requirements and drafts, but applicant attestations and final submission remain user-controlled. CAPTCHA, MFA, access-control and other anti-abuse mechanisms are not bypassed.
