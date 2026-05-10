# Current State — WFM Labs Hub

**Last updated:** 2026-05-10
**Phase:** Week 1 complete, ready for Week 2
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

## Live Deployment

- **Vercel:** https://wfmlabs-hub-local.vercel.app
- **Admin:** https://wfmlabs-hub-local.vercel.app/admin
- **Admin user:** ted@wfmlabs.com (created 2026-05-10)
- **Netlify site exists** but doesn't work for Payload (server actions incompatibility). Vercel is production.

## What Does NOT Exist Yet
- GitHub → Vercel auto-deploy (deploying via CLI currently)
- CI workflow (GitHub Actions)
- Topics collection
- Content collections (Papers, Articles, Tools, NewsletterIssues)
- Engagement collections (Discussions, Reactions, Notifications)
- Any content loaded
- Frontend pages beyond homepage placeholder

## Current Phase: Week 2 (starting)

Next deliverables:
1. Connect GitHub to Vercel for auto-deploy
2. Topics collection + seed taxonomy
3. Papers, Articles, Tools, NewsletterIssues collections
4. Access control functions
5. Postgres FTS indexes

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
