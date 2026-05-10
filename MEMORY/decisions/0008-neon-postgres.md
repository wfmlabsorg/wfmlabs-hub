# ADR 0008: Neon Postgres with Branching for Previews

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Need a database for Payload CMS. Already using Neon for personal TARS database and WFMWiki database (dedicated project). Payload supports Postgres via `@payloadcms/db-postgres`.

## Decision

Dedicated Neon project `wfmlabs-hub` with serverless Postgres. Separate from personal and WFMWiki Neon projects.

## Alternatives considered

### Shared Neon project
Use existing personal Neon project. **Rejected:** Separation of concerns. Hub data should be independent.

### Supabase
Postgres with extra features. **Rejected:** Additional abstraction layer not needed. Neon's branching feature is valuable for preview environments.

## Consequences

### Positive
- Serverless auto-scaling
- Database branching for PR preview environments
- Point-in-time recovery (7 days on free tier)
- Already in Ted's infrastructure stack
- Dedicated project = clean isolation

### Negative
- Free tier has compute limits (upgrade to $19/mo Scale when needed)
- Another Neon project to manage (now 3 total)

## References

- Seed doc v1.1, Section 5.1
