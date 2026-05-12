# Changelog — WFM Labs Hub

All notable changes to the WFM Labs Hub platform. Updated after every meaningful TARS session.

Format: `[date] — [summary]` with details.

---

## 2026-05-12 — Phase A Deploy + ROC Migration Plan + Auth Bridge

### Deployment
- Hub deployed to production at `community.wfmlabs.com` (Vercel)
- 32 routes building, admin panel at `/admin`
- 9 env vars configured: PAYLOAD_SECRET, DATABASE_URI, NEXT_PUBLIC_SERVER_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_SECRET, AUTH_URL, ROC_API_KEY

### OAuth
- Created Google OAuth app (project: maptiles-roc2) for `community.wfmlabs.com`
- Created GitHub OAuth app under wfmlabsorg for `community.wfmlabs.com`
- Auth env vars use `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` convention (matching NextAuth config in `src/lib/auth.ts`)

### Profile Redesign (from May 11 session, pushed today)
- Two-tier member profile: Tier 1 (industry/workforce) + Tier 2 (OVIX contributor)
- Industry taxonomy: 14 industries, 5 workforce types, sourcing types
- OVIX Contributor profile: workforce footprint grid (city/state/country/headcount/sourcing/type), customer geography with EU scope
- BPO/outsourcer distinction with client industries multi-select
- Cross-platform auth API: `POST /api/auth/verify` + `GET /api/members/profile/[id]`
- Two-step setup flow, OVIX settings tab, privacy controls
- Industry filters and OVIX badges in member directory
- ADR-0016: Profile redesign + cross-platform auth

### Taxonomy Tweaks
- Added EU to `CUSTOMER_GEO_SCOPES` (between US+neighbors and International)
- Added `euCountries` field to Members collection customerGeography group
- Updated OVIX contributor opt-in with detailed explanation text
- EU conditional UI in setup page, settings page, member profile view, setup API route

### Infrastructure
- Local clone at `~/projects/wfmlabs-hub/` (bun install works; cloud dir breaks node_modules)
- GitHub repo: `wfmlabsorg/wfmlabs-hub` — 34 commits
- Neon database schema synced via dev mode
- TypeScript types regenerated (1609 lines, includes all OVIX profile types)

### ROC Deep Dive
- Cloned and analyzed `wfmlabsorg/roc` — 7,142 lines of Worker code
- Mapped 28 ingest feed functions (GDACS, USGS, NWS, EONET, GDELT, OTX, ReliefWeb, CISA, CF Radar, IODA, power outages, WHO, Smithsonian, OpenAQ, FIRMS, FRED, EMSC, NHC, CDC, SPC, Tsunami, SWPC, Aviation, OpenSky, GDACS24h, MeteoAlarm, SPCReports)
- Documented OVIX scoring model: 4 categories, composite = average, volatility = 6hr stddev
- Mapped region hierarchy: 5 macro → 38 sub → 118 metro hubs
- Examined live ROC Neon DB: 25 tables, 3 materialized views, 453K scoring rows, PostGIS 3.5.0
- Discovered Worker cron paused since May 9

### Migration Plan (ADR-0017)
- 6-phase migration plan: Auth Bridge → OpenMCT to Vercel → Signals → Chat→Discussions → OVIX Pages → Domain Consolidation
- Key decisions: no iframe (OpenMCT assets move to Vercel), Ably extends to Hub, two DBs stay separate
- Estimated 7-9 working days

### Auth Bridge (Phase 1)
- ROC Worker `extractUser()` now tries legacy JWT first, falls back to Hub `/api/auth/verify`
- Added `verifyHubToken()` to ROC `auth.ts`
- Updated all 9 `extractUser()` call sites to pass Hub config
- Hub verify endpoint accepts token via body JSON and validates `X-ROC-API-Key`
- Generated `ROC_API_KEY`, set on Vercel
- Pending: set CF Worker secrets (`HUB_URL`, `ROC_API_KEY`) and redeploy

### Commits
1. `700e195` — feat: two-tier profile redesign + cross-platform auth API
2. `0c799d7` — chore: regenerate types + add profile-redesign migration
3. `8ad6183` — fix: type cast in auth verify route
4. `973d978` — docs: session note + update current-state after Phase A deploy
5. `912c0bd` — feat: auth bridge — verify endpoint accepts ROC API key + body token
6. `a98af58` (ROC) — feat: auth bridge — accept Hub JWTs alongside legacy ROC tokens

---

## 2026-05-11 — Profile Redesign + Cross-Platform Auth

### Two-Tier Profile
- Redesigned Members collection with Tier 1 (basic) + Tier 2 (OVIX contributor)
- Created taxonomy constants: 14 industries, 5 workforce types, sourcing types, geo scopes
- Workforce footprint grid: repeatable rows with city/state/country/headcount/sourcing/type
- Customer geography: scope hierarchy (single state → regional → national → international)
- BPO/outsourcer flag with client industries multi-select
- Privacy controls: showIndustry, showOvixData toggles

### Cross-Platform Auth
- `POST /api/auth/verify` — JWT verification for ROC Worker
- `GET /api/members/profile/[id]` — full profile read with dual auth (API key + JWT)
- CORS headers for ROC origin
- `rocUserId` field on Members for cross-platform mapping

### Frontend
- Two-step setup flow: Step 1 (basic profile) → Step 2 (OVIX contributor opt-in)
- Settings page with OVIX Contributor tab
- Member profile view with industry badges, OVIX data section
- Members directory with industry filter chips, OVIX Contributors toggle

### ADR-0016
- Payload as ecosystem identity source
- Two-tier profile design
- Cross-platform auth via shared API
- Industry taxonomy as inline constants
- Company field demoted

---

## 2026-05-10 — Application Build (sessions prior to TARS involvement)

### Commits (from git history)
- Scaffolded Next.js 15 + Payload CMS 3.84 application
- Initial DB migration + all collections migration
- 13 collections: Members, Topics, Papers, Articles, Tools, WikiEntries, NewsletterIssues, Media, Discussions, Reactions, AssetVersions, AssetRelationships, AssetContributions
- Authentication: NextAuth v5 (email/password + Google + GitHub OAuth)
- Role-based access control (admin, moderator, member)
- Member onboarding flow + profile settings
- Privacy-aware profiles, expertise topics, enhanced directory
- HF-inspired frontend with browse and detail pages
- Cross-cutting Discussion + Reactions components
- Research section with 15 seeded papers from FOW-Value
- 13 tools seeded with methodology content
- Data Sources section with live OVIX API integration
- OAuth lazy init fix

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
- Documentation structure
- WFMLabsHub TARS skill
- Session protocol for continuous multi-session builds

### Content Strategy Revision
- Launch content reframed around exclusive assets:
  - ~10 tool pages with methodology narratives
  - 3-5 original articles from FOW-Value material
  - 10-15 curated papers with expert commentary
  - 5-8 topic landing pages with editorial framing
- ADR-0015: curate fresh content over Mighty migration
