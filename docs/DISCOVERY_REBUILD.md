# Discovery rebuild

The discovery service now exposes configuration for a layered search/crawl pipeline:

- `SEARXNG_URL` enables an optional self-hosted SearXNG metasearch endpoint.
- `DISCOVERY_MAX_PAGES` bounds fetched pages per run.
- `DISCOVERY_MAX_DEPTH` bounds link traversal depth.
- `DISCOVERY_CONCURRENCY` controls parallel work.
- `DISCOVERY_PLAYWRIGHT_ENABLED` enables a browser-rendering fallback when the runtime provides Playwright.

The intended execution order is:

1. Generate expanded scholarship, fellowship, studentship, assistantship, and research-funding queries.
2. Search configured providers, including SearXNG when configured.
3. Fetch direct, RSS, and search-result URLs with bounded concurrency and depth.
4. Extract candidate title, provider, deadline, funding, eligibility, and application links.
5. Canonicalize URLs and remove tracking parameters.
6. Deduplicate by canonical URL and opportunity identity.
7. Score candidates, preserve uncertain records for review, and persist diagnostics.

SearXNG is optional: the existing search adapters remain the fallback when `SEARXNG_URL` is empty. Credentials must remain in environment variables and never in source or configuration files.
