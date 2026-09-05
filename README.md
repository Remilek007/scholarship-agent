# Scholarship Agent

Forestry-first scholarship discovery and application assistant for funded Master's opportunities worldwide.

## Current pipeline

`query planning → multi-provider discovery → deduplication → deep page extraction → funding classification → eligibility assessment → source verification → PostgreSQL snapshots → strict ranking → application requirements → factual answer preparation → human review`

The system is intentionally free-first and provider-neutral. Search adapters can be swapped without changing the scholarship pipeline.

## Forestry focus

The search taxonomy prioritizes Forestry, Forest Science, Forest Management, Silviculture, Forest Ecology, Tropical Forestry, Wildlife Conservation, Conservation Biology, Biodiversity, Natural Resource Management, Agroforestry, Forest Carbon/REDD+, GIS and Remote Sensing, while also discovering interdisciplinary climate and conservation opportunities.

## Discovery

Discovery can combine configured direct pages and RSS feeds with provider APIs. Tavily has a free tier with 1,000 API credits per month and no credit card requirement according to its current documentation. citeturn2search2turn2search5 Brave Search is also supported as an optional provider; its API requires an API key and should be treated as an optional provider rather than a guaranteed free service. citeturn1search0turn1search2

Configured providers are enabled only when their environment variables are present, so the core pipeline does not require a paid provider.

## Verification and ranking

- Funding is classified from page evidence rather than provider labels alone.
- Fully funded and substantially funded opportunities qualify; partial and unfunded opportunities are excluded from the qualifying pool.
- Eligibility is treated as a gate rather than something a high relevance score can compensate for.
- Unknown eligibility remains review-only instead of being silently treated as eligible.
- Deep extraction stores evidence snapshots so recommendations can be audited later.
- Suspicious sources are not allowed to qualify through funding/relevance alone.

## Application intelligence

The application workspace now provides:

- extracted requirements grouped by document/application category
- readiness tracking for required items
- manual requirement status controls: missing, ready, attached, waived
- automatic preparation of factual answers from the applicant profile
- an explicit question bank for missing personal, research, career, achievement, English-evidence and referee information
- editable prepared answers with provenance shown as profile facts
- application events for preparation and requirement changes
- user-controlled final review and submission

The system deliberately does not invent personal history, research claims, achievements, work experience, referee details or other application facts. Those become explicit inputs for later drafting.

## Workspace

- `apps/` — web dashboard and application workspace
- `services/api/` — Express API
- `services/discovery/` — discovery, deep extraction, verification and persistence orchestration
- `packages/search/` — query generation, search providers, funding classification, eligibility, ranking and application intelligence
- `packages/database/` — PostgreSQL/Drizzle schema and repository
- `packages/schemas/` — request validation
- `packages/shared/` — shared domain types
- `config/search/forestry.json` — Forestry/Wildlife/Conservation taxonomy

## Important API endpoints

- `GET /health`
- `GET /api/discovery/health`
- `GET /api/discovery/sources`
- `POST /api/discovery/plan`
- `POST /api/discovery/search`
- `POST /api/discovery/run` — deep enrichment is enabled by default
- `POST /api/matches` — score supplied candidates
- `POST /api/matches/top` — return up to 20 strict qualifying Master's matches
- `GET /api/scholarships`
- `GET /api/scholarships/:id`
- `POST /api/scholarships/:id/verify`
- `POST /api/applications`
- `GET /api/applications`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id`
- `PATCH /api/applications/:id/requirements/:requirementId`
- `PUT /api/applications/:id/answers`
- `POST /api/applications/:id/prepare` — prepare profile-grounded factual answers and return missing-information prompts
- `POST /api/applications/:id/events`

## Environment

Copy `.env.example` to `.env` and configure PostgreSQL. Discovery sources are optional until their adapters are configured.

Optional search credentials:

- `TAVILY_API_KEY` — free-tier web search provider
- `BRAVE_SEARCH_API_KEY` — optional Brave web search provider
- `DISCOVERY_SEARCH_ENDPOINT` + `DISCOVERY_SEARCH_API_KEY` — custom provider adapter
- `DISCOVERY_RSS_FEEDS` — comma-separated RSS/Atom feeds
- `DISCOVERY_DIRECT_URLS` — comma-separated direct source URLs

Credentials and API keys must stay in environment variables and must never be committed.

## Application safety

The application workspace is designed for human review. It can prepare requirements and profile-grounded answers, but final submission and applicant attestations remain user-controlled. CAPTCHA, MFA, access-control and other anti-abuse mechanisms are not bypassed.
