# WFM Labs Hub — TARS Session Bootstrap

## Quick Reference
- **Seed doc:** `wfmlabs-platform-seed-v1.1.md` (source of truth for all architecture decisions)
- **Current state:** `MEMORY/current-state.md` (what exists, what works, what's next)
- **Open questions:** `MEMORY/open-questions.md`
- **Phase:** 1 (Foundation — no commerce, no agents)
- **Status:** Week 1 in progress. Scaffold built, deploying to Netlify.

## Architecture
- **CMS:** Payload CMS 3.x (ecosystem-wide headless backbone, not single-site)
- **Frontend:** Next.js 16 App Router + React 19
- **Database:** Neon Postgres (dedicated project)
- **Storage:** Cloudflare R2 (bucket `wfmlabs-media`)
- **Email:** Resend + React Email
- **Hosting:** Netlify (NOT Vercel — consolidated with 118 other WFM Labs sites)
- **Search:** Postgres full-text search (no Meilisearch until content > 500)
- **Styling:** Tailwind v4 + shadcn/ui
- **Package manager:** Bun (NEVER npm/yarn/pnpm)

## Phase 1 Scope
Build value, not commerce. Authenticated members browse curated content and engage in flat discussions. No payments, no tier gating, no agents.

**In scope:** Members, Papers, Articles, Tools, NewsletterIssues, Discussions, Reactions, Notifications, Topics, AuditLog, Media. Five page templates. Postgres FTS. Email (welcome, verification, reset, reply notification). 20 beta members.

**Out of scope:** Stripe/payments, tier-gated access, Jobs, Scenarios, Events, Badges, AgentRuns, Meilisearch, Sentry, analytics, agents, ROC/OpenMCT, Mighty migration.

## Session Protocol
1. Read this file (auto-loaded)
2. Read `MEMORY/current-state.md`
3. Read 3 most recent session notes in `MEMORY/sessions/`
4. If making architectural decisions, read relevant ADRs in `MEMORY/decisions/`
5. Do the work
6. Write session note to `MEMORY/sessions/YYYY-MM-DD-HHMM-topic.md`
7. Update `MEMORY/current-state.md` if state changed
8. Write ADR if significant decision made
9. Update this file if phase status or conventions changed

## Build Conventions
- **Commits:** `type(scope): description` (feat/fix/docs/chore/refactor/test)
- **Branches:** feature branches off main, PR per feature
- **Tests:** Required for access control functions. Vitest for unit/integration, Playwright for E2E.
- **Pre-commit:** Prettier + ESLint via Husky + lint-staged
- **Types:** Run `payload generate:types` after collection changes

## Key Decisions (ADRs)
| # | Decision |
|---|----------|
| 0001 | Payload as ecosystem-wide content backbone |
| 0002 | Netlify hosting (supersedes Vercel) |
| 0004 | Flat repo, no monorepo |
| 0009 | Postgres FTS over Meilisearch |
| 0010 | Commerce deferred to Phase 2 |
| 0011 | Flat discussions with @-mentions |
| 0012 | Agents as Members with type field |
| 0015 | Curate fresh content over Mighty migration |

Full ADRs in `MEMORY/decisions/`.

## What Exists
- Seed document v1.1
- MEMORY directory with 15 ADRs, current-state, open-questions
- Documentation structure (`docs/`)
- WFMLabsHub TARS skill

## What's Next
Week 1: Initialize repo, push to GitHub, scaffold Next.js + Payload, create Vercel/Neon/R2 projects, verify preview deployments.

## Known Issues
None (pre-build).
