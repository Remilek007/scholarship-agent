# Discovery pipeline

The discovery service uses a layered, bounded pipeline. It is designed to find opportunities broadly while keeping the authoritative-source check separate from discovery.

## Pipeline

1. Generate expanded scholarship, fellowship, studentship, assistantship, thesis, supervisor-funded and research-position queries.
2. Search configured providers, including SearXNG when `SEARXNG_URL` is configured.
3. Crawl configured registry/direct seeds with Crawlee, following relevant links and pagination within `DISCOVERY_MAX_PAGES` and `DISCOVERY_MAX_DEPTH`.
4. Crawl SearXNG result URLs through the same bounded crawler so search results are not just titles/snippets; main-content extraction produces richer records.
5. When enabled, use Playwright for HTTP failures and pages that look like JavaScript shells.
6. Canonicalize URLs, strip common tracking parameters, and deduplicate by URL and opportunity identity.
7. Deep-enrich selected records for funding, eligibility, requirements, deadlines and application links.
8. Classify records as `discovered`, `extracted`, `eligible`, `review-needed`, or `rejected`.
9. Persist discovery provenance including original URL, search engine, query, method, lifecycle status and failure reason when `DATABASE_URL` is configured.
10. Persist eligible/review candidates into the scholarship database for downstream matching and manual analysis.

## Sources

The registry includes government scholarship programs, international organizations, research organizations, scholarship directories, universities/department discovery, and academic/research job boards. Directory and job-board entries are discovery sources only; the application/funding claim must be verified against the authoritative institution or funder.

## Configuration

- `SEARXNG_URL` — optional self-hosted SearXNG endpoint.
- `SEARXNG_ENGINES` — comma-separated engines requested from SearXNG.
- `DISCOVERY_MAX_PAGES` — maximum pages processed by a bounded crawl.
- `DISCOVERY_MAX_DEPTH` — maximum link depth.
- `DISCOVERY_CONCURRENCY` — crawler concurrency.
- `DISCOVERY_REQUEST_TIMEOUT_MS` — per-request timeout.
- `DISCOVERY_PLAYWRIGHT_ENABLED` — enables browser fallback for JavaScript-rendered pages.
- `DISCOVERY_DIRECT_URLS` — additional comma-separated seed URLs.
- `DISCOVERY_RSS_FEEDS` — optional RSS/Atom feeds.

Keep API keys and database credentials in environment variables. Never commit secrets.

## Database migration

After deploying this revision, apply `packages/database/drizzle/0004_discovery_provenance.sql` to existing PostgreSQL databases before running discovery with persistence enabled.
