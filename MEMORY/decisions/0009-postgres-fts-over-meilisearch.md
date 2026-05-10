# ADR 0009: Postgres Full-Text Search Over Meilisearch for Phase 1

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Seed doc v1.0 specified Meilisearch (self-hosted on Hetzner $5/mo or Cloud $25/mo). With ~40 initial content items and 20 members, a dedicated search engine adds ops surface for a problem that doesn't exist yet.

## Decision

Use Postgres full-text search via `tsvector` columns on searchable collections. No additional service. Upgrade to Meilisearch when content exceeds 500 items or members report search quality issues.

## Alternatives considered

### Meilisearch from Day 1
Typo-tolerant, faceted search. **Rejected for Phase 1:** Adds self-hosted ops burden or $25/mo Cloud cost for < 100 items. The search API contract (`/api/search?q=...`) stays the same regardless of backend, so migration is non-breaking.

### Algolia
SaaS search. **Rejected:** Expensive at scale, vendor lock-in.

## Consequences

### Positive
- Zero additional services or cost
- No sync hooks needed (search is native to the database)
- Simpler ops for solo operator
- API contract designed for backend-agnostic swap

### Negative
- No typo tolerance (Postgres FTS is exact)
- No faceted search UI without manual implementation
- Must migrate to Meilisearch when scale warrants

## References

- Seed doc v1.1, Section 4.4
