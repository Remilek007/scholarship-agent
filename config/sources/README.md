# Discovery source registry

This directory is reserved for the source registry used by the discovery pipeline.

Sources should be classified as:

- `official`: government, university, foundation, or provider-controlled source. These can support verification.
- `aggregator`: discovery-only source. Never treat an aggregator as final proof of eligibility, funding, or deadline.
- `research`: university department, laboratory, supervisor, or funded research-position source.

For every enabled source, record its canonical URL/feed, geography, coverage, access method, and any published rate limits. Do not add credentials to this directory; secrets belong in environment variables.
