# WFM Labs Hub — TARS Session Bootstrap

## Quick Reference
- **Live URL:** `community.wfmlabs.com` (gated — OAuth required)
- **Repos:** `wfmlabsorg/wfmlabs-hub` (Hub) + `wfmlabsorg/roc` (ROC/Workers)
- **Local clone:** `~/projects/wfmlabs-hub/` (NEVER use `~/cloud/projects/wfmlabs-hub/`)
- **Phase:** 2 (Deployed, agents live, commerce next)
- **Status:** Operational. 80+ commits. Beacon + Sentinel agents active.

## Architecture
- **CMS:** Payload CMS 3.x (ecosystem-wide headless backbone)
- **Frontend:** Next.js 15 App Router + React 19
- **Database:** Neon Postgres — two projects under WFM Labs org:
  - `wfmlabs-hub` — CMS/identity (Members, Articles, Signals, Discussions, etc.)
  - `roc` — operational data (ovix_scores, events, regions, signals, chat)
- **Hosting:** Vercel (community.wfmlabs.com)
- **Workers:** 3 Cloudflare Workers:
  - `ovix-api` — OVIX scoring engine, 28 feeds, 5-min cron
  - `beacon-agent` — knowledge scout, 3x daily
  - `sentinel-agent` — incident analyst, 5-min cron
- **Real-time:** Ably (Sentinel broadcasts, future chat)
- **Auth:** NextAuth v5 (Google + GitHub OAuth), Hub is authoritative identity source
- **Package manager:** Bun (NEVER npm/yarn/pnpm)

## What's Live
- 14 Payload collections: Members, Articles, Papers, Tools, WikiEntries, Signals, Discussions, Reactions, Topics, Media, NewsletterIssues, AssetVersions, AssetRelationships, AssetContributions
- OpenMCT command center at `/roc` with Cesium globe + 12 dashboards
- Beacon agent posting wiki-linked articles 3x daily
- Sentinel agent detecting incidents every 5 min across all domains
- 1,000+ signals in feed (weather, health, infrastructure, seismic, disaster, cyber)
- Access gating: unauthenticated → landing page, registered → full access
- Admin OAuth-only (no email/password login)
- Pricing page (coming soon — Individual $199/yr, Team $799/yr, Corporate $2,499/yr)
- 19 ROC docs migrated as wiki entries with full markdown rendering
- Discussions on articles, research, tools, wiki, compass detail pages
- Workforce footprint: in-office/hybrid/virtual work models, 195 countries, geo spread
- Membership tiers: free/trial/practitioner/practitioner-plus

## Agents
| Agent | Member ID | Worker URL | Cadence | Status |
|-------|-----------|-----------|---------|--------|
| Beacon | 5 | beacon-agent.tedlango.workers.dev | 3x daily | v0.3 — wiki-first, verified links |
| Sentinel | 6 | sentinel-agent.tedlango.workers.dev | Every 5 min | v0.1 — multi-domain |
| Sigma | — | — | On-demand | Spec'd (JupyterLite) |

## API Keys (all set on Vercel + CF Workers)
- `ROC_API_KEY` — Hub ↔ ROC Worker auth
- `BEACON_API_KEY` — Hub ↔ Beacon Worker
- `SENTINEL_API_KEY` — Hub ↔ Sentinel Worker
- `ANTHROPIC_API_KEY` — Claude Sonnet for agents
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`

## Key Decisions (ADRs)
| # | Decision |
|---|----------|
| 0001 | Payload as ecosystem-wide content backbone |
| 0004 | Flat repo, no monorepo |
| 0009 | Postgres FTS over Meilisearch |
| 0012 | Agents as Members with type field |
| 0015 | Curate fresh content over Mighty migration |
| 0016 | Profile redesign + cross-platform auth (Payload as identity source) |
| 0017 | ROC/OVIX migration into Hub (6 phases) |
| 0018 | Commerce — subscription tiers & gating |
| 0019 | Value strategy — OVIX, Intelligence Briefings, Custom Agents |

Full ADRs in `MEMORY/decisions/`.

## Session Protocol
1. Read this file (auto-loaded)
2. Read `MEMORY/current-state.md`
3. Read most recent session notes in `MEMORY/sessions/`
4. If making architectural decisions, read relevant ADRs
5. Do the work
6. Write session note + update current-state
7. Update changelog (`docs/CHANGELOG.md`)
8. Update this file if architecture changed
9. Commit and push to GitHub

## Build Conventions
- **Commits:** `type(scope): description` — feat/fix/docs/chore
- **Local dev:** `~/projects/wfmlabs-hub/` only (cloud dir has broken git)
- **Types:** Run `payload generate:types` after collection changes
- **Schema push:** `bun run dev` to push Payload schema to Neon
- **Deploy:** `vercel deploy --prod --yes` from local clone
- **Agent deploy:** `cd workers/<name> && bunx wrangler deploy`

## Known Issues
- Signal feed weather-dominated (scoring engine also posts signals via postSignalsToHub — needs disabling)
- Cyber/seismic/disaster/financial signals underrepresented vs weather volume
- Docs markdown rendering edge cases with complex tables
- Old Beacon articles (id 1, 2) have dead wiki links (pre-v0.3)
- Frameworks/Scenarios routes exist but removed from nav

## Next Priorities
1. Fix signal weather flood
2. Stripe integration (revenue infrastructure)
3. Signal page server-side category filter
4. Sigma agent prototype (JupyterLite)
5. Content seeding for beta launch
6. Homepage iteration
