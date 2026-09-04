# Scholarship Agent

Forestry-first scholarship discovery and application assistant for funded master's opportunities worldwide.

## Current pipeline

`discovery queries → multi-source discovery → normalization → deduplication → PostgreSQL persistence → scholarship API`

The system is intentionally free-first and provider-neutral. Search adapters can be swapped without changing the scholarship pipeline.

## Workspace

- `apps/` — web dashboard (next implementation stage)
- `services/api/` — Express API
- `services/discovery/` — discovery orchestration and persistence
- `packages/search/` — query generation, funding classification, ranking, search adapters
- `packages/database/` — PostgreSQL/Drizzle schema and repository
- `packages/schemas/` — request validation
- `packages/shared/` — shared domain types
- `config/search/forestry.json` — Forestry/Wildlife/Conservation taxonomy

## Environment

Copy `.env.example` to `.env` and configure PostgreSQL. Discovery sources are optional until their adapters are configured.

Important: credentials and API keys must stay in environment variables and must never be committed.

## API

- `GET /health`
- `POST /api/discovery/plan`
- `POST /api/discovery/search`
- `POST /api/discovery/search?persist=false`
- `GET /api/scholarships`

The application is designed to distinguish unknown funding/eligibility from verified eligibility. It should never treat an unverified opportunity as fully funded merely because an aggregator says so.
