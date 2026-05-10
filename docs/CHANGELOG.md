# Changelog — WFM Labs Hub

All notable changes to the WFM Labs Hub platform. Updated after every meaningful TARS session.

Format: `[date] — [summary]` with details.

---

## 2026-05-09 — Project inception and architecture

### Seed Document
- Created seed document v1.0 (initial architecture spec)
- Revised to v1.1 after deep analysis of WFM Labs ecosystem

### Key Decisions (v1.1)
- Payload CMS scoped as ecosystem-wide headless backbone (not single-site CMS)
- Flat repo structure (no monorepo/Turborepo for Phase 1)
- Commerce (Stripe, tiers, trials) deferred to Phase 2
- Postgres full-text search replaces Meilisearch for Phase 1
- Flat discussions with @-mentions (schema supports future nesting)
- Services reduced to 5: Vercel, Neon, R2, Resend, GitHub
- Content: curate ~40 fresh items vs. mine Mighty Networks
- Tailwind v4 (not v3.4)
- Founding Member = boolean flag, not separate tier

### Infrastructure Created
- MEMORY directory with 15 Architecture Decision Records
- Project CLAUDE.md (TARS session bootstrap)
- Documentation structure (this file, status.md, architecture.md)
- WFMLabsHub TARS skill
- Session protocol for continuous multi-session builds

### Content Strategy Revision (same session)
- Dropped "republish free content" approach — newsletters and free papers behind a login don't create value
- Launch content reframed around assets that don't exist elsewhere:
  - ~10 tool pages with methodology narratives (tools already deployed on Netlify)
  - 3-5 original articles adapted from FOW-Value material (value planning, SDRM, cognitive portfolio)
  - 10-15 curated papers from FOW-Value evidence library (207 sources) with expert commentary
  - 5-8 topic landing pages with editorial framing
- Compass newsletter archive moves to Phase 2 library addition
- ADR-0015 updated to reflect this approach

### What's Next
- Week 1: Initialize git repo, push to GitHub, scaffold Next.js + Payload, create Vercel/Neon/R2 projects
