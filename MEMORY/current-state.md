# Current State — WFM Labs Hub

**Last updated:** 2026-05-09
**Phase:** Week 1 in progress
**Seed doc version:** v1.1

## What Exists

- Seed document v1.1 (`wfmlabs-platform-seed-v1.1.md`) — source of truth
- Seed document v1.0 (`wfmlabs-platform-seed-v1.md`) — archived for reference
- MEMORY directory with 15 initial ADRs + 1 learning
- TARS session infrastructure (CLAUDE.md, WFMLabsHub skill)
- Documentation structure (`docs/`)
- **Git repo initialized, pushed to `wfmlabsorg/wfmlabs-hub` (private)**
- **Next.js 16.2.6 + Payload CMS 3.84.1 scaffolded and build-verified**
- **Media collection (first collection)**
- **Frontend layout + homepage placeholder**
- **Payload admin routes wired** (`/admin`, `/api`)
- **Tailwind v4.3 + PostCSS configured**

## Dev Environment

- **Cloud dir (git):** `~/cloud/projects/wfmlabs-hub/`
- **Local dev dir (node_modules):** `~/projects/wfmlabs-hub-local/`
- node_modules MUST be in local dir due to R2 sync performance (see learnings/2026-05-09-wsl2-cloud-dir-perf.md)

## What Does NOT Exist Yet

- Neon database project
- R2 bucket (`wfmlabshub-media`)
- Vercel project
- Environment variables configured
- CI workflow (GitHub Actions)
- Any collections beyond Media
- Any content

## Current Phase: Week 1 (in progress)

Remaining Week 1 items:
1. Create Neon project `wfmlabs-hub`
2. Create R2 bucket `wfmlabshub-media`
3. Create Vercel project + link to GitHub
4. Configure environment variables
5. Set up GitHub Actions CI
6. Verify preview deployment works
7. Verify Payload admin UI connects to database

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
