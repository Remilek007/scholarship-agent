# Scholarship Agent

Forestry-first scholarship discovery and application assistant for funded Master's opportunities worldwide.

## Current pipeline

`query planning → multi-source discovery → deduplication → deep page extraction → funding classification → eligibility assessment → source verification → PostgreSQL snapshots → strict ranking → application workspace`

The system is intentionally free-first and provider-neutral. Search adapters can be swapped without changing the scholarship pipeline.

## Forestry focus

The search taxonomy prioritizes Forestry, Forest Science, Forest Management, Silviculture, Forest Ecology, Tropical Forestry, Wildlife Conservation, Conservation Biology, Biodiversity, Natural Resource Management, Agroforestry, Forest Carbon/REDD+, GIS and Remote Sensing, while also discovering interdisciplinary climate and conservation opportunities.

## Verification and ranking

- Funding is classified from page evidence rather than provider labels alone.
- Fully funded and substantially funded opportunities qualify; partial and unfunded opportunities are excluded from the qualifying pool.
- Eligibility is treated as a gate rather than something a high relevance score can compensate for.
- Unknown eligibility remains review-only instead of being silently treated as eligible.
- Deep extraction stores evidence snapshots so recommendations can be audited later.
- Suspicious sources are not allowed to qualify through funding/relevance alone.

## Workspace

- `apps/` — web dashboard and application workspace
- `services/api/` — Express API
- `services/discovery/` — discovery, deep extraction, verification and persistence orchestration
- `packages/search/` — query generation, funding classification, eligibility and ranking
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

## Environment

Copy `.env.example` to `.env` and configure PostgreSQL. Discovery sources are optional until their adapters are configured.

Credentials and API keys must stay in environment variables and must never be committed.

## Application safety

The application workspace is designed for human review. It can prepare requirements and draft answers, but final submission and applicant attestations remain user-controlled. CAPTCHA, MFA, access-control and other anti-abuse mechanisms are not bypassed.
