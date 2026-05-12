# Session: Phase A Deploy + ROC Migration Plan + Auth Bridge

Date: 2026-05-12 09:30
Phase: Build (deployed, migration planning)

## Goal
Complete Phase A deployment, review ROC codebase, draft migration plan, begin auth bridge.

## What we did

### Phase A — Hub Deployment
- Answered open questions from May 11 session (shared API auth, no company names, EU geo scope, OVIX opt-in)
- Applied taxonomy tweaks: EU added to CUSTOMER_GEO_SCOPES, OVIX contributor explanation text, euCountries field across Members collection + all frontend pages + setup API route
- Resolved bun install failure on R2-synced filesystem (strips execute permissions on native binaries)
- Set up local clone at `~/projects/wfmlabs-hub/` — bun install works on local filesystem
- Pushed profile redesign to existing GitHub repo `wfmlabsorg/wfmlabs-hub` (rebased on 30-commit history)
- Ran Payload schema sync via dev mode, generated TypeScript types (1609 lines)
- Fixed type cast error in `src/app/api/auth/verify/route.ts`
- Deployed to Vercel production (`community.wfmlabs.com`)
- Configured 9 Vercel env vars: PAYLOAD_SECRET, DATABASE_URI, NEXT_PUBLIC_SERVER_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_SECRET, AUTH_URL
- Created new Google OAuth app (project: maptiles-roc2) and GitHub OAuth app for community.wfmlabs.com

### ROC Deep Dive
- Cloned `wfmlabsorg/roc` to `~/projects/roc/`
- Read all critical Worker files: index.ts (2566 lines), auth.ts (676 lines), ingest.ts (2369 lines), ovix-engine.ts (551 lines), regions.ts (313 lines)
- Mapped 28 ingest feed functions (GDACS, USGS, NWS, EONET, GDELT, OTX, ReliefWeb, CISA, CF Radar, IODA, power outages, WHO, Smithsonian, OpenAQ, FIRMS, FRED, EMSC, NHC, CDC, SPC, Tsunami, SWPC, Aviation, OpenSky, GDACS24h, MeteoAlarm, SPCReports)
- Documented OVIX scoring model: 4 categories (weather/seismic/disaster/events), composite = average, volatility = 6hr stddev
- Mapped region hierarchy: 5 macro → 38 sub → 118 metro hubs
- Examined live Neon DB: 25 tables, 3 materialized views, PostGIS 3.5.0, 453K scoring rows in May partition
- Discovered last scoring run was May 9 — Worker cron appears paused
- Read all 9 schema migrations

### Migration Plan (ADR-0017)
- Drafted 6-phase migration plan, approved by Ted
- Key decisions: no iframe (OpenMCT assets move to Vercel), Ably extends to Hub, two DBs stay separate, auth bridges via Hub
- Estimated 7-9 working days across all phases

### Auth Bridge (Phase 1 — Started)
- Modified ROC Worker `extractUser()` to try legacy JWT first, then fall back to Hub `/api/auth/verify`
- Added `verifyHubToken()` function to ROC `auth.ts`
- Updated all 9 `extractUser()` call sites in `index.ts` and `auth.ts` to pass Hub config
- Updated Hub verify endpoint to accept token via body JSON and validate `X-ROC-API-Key`
- Generated `ROC_API_KEY` and set on Vercel
- Committed and pushed both repos

## Commits this session
1. `700e195` (Hub) — feat: two-tier profile redesign + cross-platform auth API
2. `0c799d7` (Hub) — chore: regenerate types + add profile-redesign migration
3. `8ad6183` (Hub) — fix: type cast in auth verify route
4. `973d978` (Hub) — docs: session note + update current-state after Phase A deploy
5. `912c0bd` (Hub) — feat: auth bridge — verify endpoint accepts ROC API key + body token
6. `a98af58` (ROC) — feat: auth bridge — accept Hub JWTs alongside legacy ROC tokens

## Pending
- Set Cloudflare Worker secrets: `wrangler secret put HUB_URL` and `wrangler secret put ROC_API_KEY`
- Redeploy ROC Worker (`wrangler deploy`)
- Investigate ROC Worker cron pause
- Phase 2: Move OpenMCT assets to Vercel
- Phase 3: Signals collection in Hub
- Phase 4-6: Discussions, OVIX pages, domain consolidation
- Test OAuth login end-to-end
- Detailed changelog in Hub

## What we learned
- R2-synced filesystem strips execute permissions on native binaries — always use local clone
- Subagents can't access files outside the project working directory — do cross-repo research directly
- ROC Worker uses `extractUser()` as the single auth extraction point (9 call sites) — clean pattern for bridging
- Neon HTTP SQL API (`/sql` endpoint) is a fast way to inspect live DB without psql
- ROC has 453K scoring rows in a single month partition — substantial operational data
