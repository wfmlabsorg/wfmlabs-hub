# Current State — WFM Labs Hub

**Last updated:** 2026-05-09
**Phase:** Pre-build (seed document finalized, infrastructure not yet created)
**Seed doc version:** v1.1

## What Exists

- Seed document v1.1 (`wfmlabs-platform-seed-v1.1.md`) — source of truth
- Seed document v1.0 (`wfmlabs-platform-seed-v1.md`) — archived for reference
- MEMORY directory with 15 initial ADRs
- TARS session infrastructure (CLAUDE.md, WFMLabsHub skill)
- Documentation structure (`docs/`)

## What Does NOT Exist Yet

- Git repository (not initialized)
- GitHub repo (`wfmlabsorg/wfmlabs-hub`)
- Next.js application
- Payload CMS configuration
- Neon database project
- R2 bucket
- Vercel project
- Any collections or content
- Any frontend pages

## Current Phase: Pre-Build

Next step is Week 1 execution:
1. Initialize git repo
2. Push to GitHub
3. Scaffold Next.js + Payload app
4. Create Vercel project
5. Create Neon project
6. Create R2 bucket
7. Configure environment variables
8. Verify preview deployment works

## Decisions Made

See `decisions/` for full ADRs. Key decisions:
- Payload CMS as ecosystem-wide content backbone (not single-site CMS)
- Flat repo structure (no monorepo for Phase 1)
- Commerce (Stripe, tiers) deferred to Phase 2
- Postgres FTS over Meilisearch for Phase 1
- Flat discussions with @-mentions
- 5 services only: Vercel, Neon, R2, Resend, GitHub
- Curate fresh content over Mighty migration
- Tailwind v4

## Open Questions

See `open-questions.md` for unresolved items.

## Known Issues

None yet (pre-build).
