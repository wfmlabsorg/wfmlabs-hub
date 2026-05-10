# Session: Project Inception and Architecture

Date: 2026-05-09 20:30
Phase: Pre-build

## Goal
Review seed document v1.0, identify risks, redesign architecture with knowledge of full TARS infrastructure and WFM Labs ecosystem, create session infrastructure for continuous builds.

## What we did
- Deep reconnaissance of entire WFM Labs ecosystem (skills, repos, databases, deployments)
- Audited all 22 GitHub repos in wfmlabsorg
- Analyzed PAI memory systems for existing WFM Labs context
- Identified 12 risks in seed doc v1.0
- Reconciled three competing strategic visions (Hub, Builder Lab, ROC/OVIX)
- Revised seed document from v1.0 to v1.1 with major changes:
  - Payload scoped as ecosystem-wide content backbone
  - Flat repo (no monorepo)
  - Commerce deferred to Phase 2
  - Postgres FTS over Meilisearch
  - Flat discussions with @-mentions
  - Services reduced from 9 to 5
  - Content: curate fresh over Mighty migration
  - Tailwind v4
- Created MEMORY directory with 15 ADRs
- Created project CLAUDE.md (session bootstrap)
- Created WFMLabsHub TARS skill
- Created documentation structure (changelog, status, architecture, data model, API, deployment)
- Wrote first session note (this file)

## What we learned
- Three separate strategic visions (Hub, Builder Lab v2, ROC/OVIX) need reconciliation — Payload as ecosystem backbone is the unifying answer
- WFM Labs has 22 repos, 14 deployed tools, 3 Neon databases, deployments across Netlify + Cloudflare Pages + Vercel (planned)
- wfmlabs.org is on Wix (not Hugo) — brand site is separate from tool catalog
- No headless CMS exists anywhere in the org — truly greenfield
- The Builder Lab ($49/mo) and Hub Practitioner Plus ($49/mo) are competing products — must be merged in Phase 2
- 18 collections in one week was unrealistic — phased across 4 weeks instead

## Content strategy pivot (same session)
- Ted challenged the "republish free content" approach — newsletters and free papers behind a login don't create value
- Inventoried existing assets: 13 deployed tools, FOW-Value model (207 sources, 600+ claims, interactive app)
- Revised content strategy to focus on exclusive content:
  - ~10 tool pages with methodology narratives
  - 3-5 original articles from FOW-Value material
  - 10-15 curated papers with expert commentary from evidence library
  - 5-8 editorially framed topic landing pages
- Compass archive → Phase 2 library addition, not launch content
- Updated seed doc Section 9, ADR-0015, changelog

## What's next
- Week 1 execution: git init, GitHub repo, Next.js + Payload scaffold, Vercel/Neon/R2 creation
- Ted needs to decide: desktop-first vs mobile-first (recommend desktop-first)
- Ted needs to prepare: select 10-15 papers from FOW-Value evidence library for curator summaries
- Ted needs to write/adapt: 3-5 original articles from FOW-Value material

## Files changed
- `wfmlabs-platform-seed-v1.1.md` — new seed document (source of truth)
- `CLAUDE.md` — TARS session bootstrap
- `MEMORY/README.md` — memory system usage guide
- `MEMORY/current-state.md` — current project state
- `MEMORY/open-questions.md` — unresolved decisions
- `MEMORY/decisions/0001-0015` — 15 Architecture Decision Records
- `MEMORY/sessions/2026-05-09-2030-project-inception.md` — this file
- `docs/README.md` — documentation index
- `docs/CHANGELOG.md` — project changelog
- `docs/status.md` — build status tracker
- `docs/architecture.md` — architecture overview
- `docs/data-model.md` — collection schemas and relationships
- `docs/api.md` — API reference (placeholder)
- `docs/deployment.md` — deployment guide (placeholder)
