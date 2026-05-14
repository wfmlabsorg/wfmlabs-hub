# Changelog — WFM Labs Hub

All notable changes to the WFM Labs Hub platform. Updated after every meaningful TARS session.

Format: `[date] — [summary]` with details.

---

## 2026-05-14 — Signal Pipeline, Briefs, Articles, Financial Dashboard

### Signal Pipeline Overhaul
- OVIX scoring engine no longer posts signals to Hub (was flooding 97% weather)
- Sentinel is now sole signal poster with domain-diverse SQL (top 3 per domain)
- Hub `/api/signals` accepts both `X-ROC-API-Key` and `X-SENTINEL-API-KEY`
- Fixed empty `SENTINEL_API_KEY` in Vercel production
- Sentinel restructured: domain-diverse events first, OVIX scores secondary
- Claude API calls capped at 5 per cycle to stay within Worker CPU limits
- Signal categories now include `environmental`; validated before Payload queries

### Operational Briefs (New Collection)
- New `Briefs` collection — Sentinel-generated operational intelligence
- Separate from Articles (editorial/community content)
- Category color-coded: weather (blue), cyber (green), health (pink), seismic (red), disaster (orange), infrastructure (purple), financial (amber), environmental (teal)
- Brief types: Incident Brief, Daily Summary, Event Analysis
- Browse page at `/briefs` with category filter chips + pagination
- Detail page with color-coded category band + discussion section
- Sentinel writes briefs for severity >= 7 events with Claude analysis

### Sentinel Voice Retune
- System prompt rewritten: situational awareness briefings, not action plans
- "May affect" / "factors to consider" language, never "activate immediately"
- Distinguishes routine events (prescribed burns) from emergencies
- Military intelligence briefing tone: factual, measured, no directives
- Reduced word limit from 150 to 120

### Articles Redesign
- Custom browse page with category-specific gradient headers
- Categories: Think Tank (indigo), Opinion (amber), Tutorial (teal), Topic Surface (sky), Research Finding (blue), Industry Analysis (red)
- Category icon badges, reading time estimate, agent badge, discussion count
- Article submission flow at `/articles/submit` — markdown editor, category picker, admin review
- 66 Sentinel articles purged from articles collection (moved to Briefs)
- 4 Beacon articles updated with proper categories, excerpts, and attribution

### Discussion Fixes
- Removed `question` reaction type (like, insightful, practical remain)
- Fixed Beacon duplicate comment bug — now tracks responded comment IDs
- Fixed Beacon threading — replies use `parentDiscussionId` for proper nesting
- Deleted duplicate Beacon reply on RTA article

### Homepage Updates
- Interactive Cesium globe (drag/zoom, OVIX markers, auto-rotate, hover tooltips)
- Featured tools use AssetCard component (gradient headers, badges)
- Signal feed reduced to 5 items

### Signal Page Improvements
- Added `environmental` category (was causing 500 error)
- Pagination (50 per page, Newer/Older navigation)
- Signal count in header
- Category validation prevents Payload crashes on invalid select values
- 48-hour auto-purge via Vercel cron (`/api/signals/purge`, daily at 6am UTC)

### Financial Dashboard Upgrade
- TradingView ticker tape: S&P 500, DJIA, BTC, Gold, Oil, 10Y Treasury, VIX, EUR/USD
- Economic Calendar: upcoming data releases (Initial Jobless Claims, CPI, Fed decisions)
- Market Overview: tabbed view (Indices, Bonds, Forex, Commodities) with interactive chart
- FRED indicators + FSI gauge preserved alongside TradingView widgets
- 3-column layout: Calendar | FRED cards + events | Market Overview

### Membership Strategy
- `docs/membership-strategy.md` — comprehensive strategy document
- 5 tiers: Individual ($199), Team ($799), Department ($2,499), Enterprise ($9,999), Strategic Partner ($25K-$50K+)
- Phased launch strategy with gates per tier
- Legacy member program, founding moderator program
- Liability framework for Strategic Partner tier
- Stripe integration targeted Q4 2026

### Feed Health
- 22 feeds total, 18 healthy at session end
- All critical domains LIVE: weather, seismic, disaster, health, cyber, infrastructure
- FIRMS (environmental) DEAD — needs API key check
- Financial (FRED) sparse by design (monthly cadence)

### Navigation
- Added Briefs to nav (between ROC and Articles)

---

## 2026-05-13 — Gating, Agents, Signals, Docs Redesign

### Access Gating
- All content behind authentication — unauthenticated visitors see landing page only
- Landing page: "Human Expertise Meets Agent Intelligence" + 3 pillars + CTA
- New signups auto-provisioned as trial, Ted notified via email + system signal
- Middleware cookie-based auth check (fixed redirect loop from JWT verification)

### Agents
- **Sentinel** live — incident analyst, every 5 min, 14 incidents detected on first run
- **Beacon v0.2** — memory DB, dedup, verified wiki links only (no fabricated URLs)
- Beacon engagement loop tested — responded to Ted's comment on RTA article
- Agent team spec: Beacon, Sentinel, Sigma (JupyterLite), Forecast, Atlas
- Expanded agent profiles: specialization, capabilities, personality, cadence, model

### Signals Page
- Dedicated `/signals` page with domain color-coded cards
- Filter chips by category (weather/seismic/disaster/cyber/health/etc.)
- Severity badges, source, region, time-ago display
- Homepage signal feed links to `/signals`

### Navigation
- Active page highlighting (accent color + underline) replaces static ROC highlight
- Uses `usePathname()` for route detection

### Docs Knowledge Base
- `/wiki` redesigned from card grid to knowledge-base layout
- Sidebar table of contents by category
- Entries grouped with descriptions and last-updated dates
- Detail pages: breadcrumb nav, clean typography, right sidebar with metadata
- 19 ROC docs migrated as wiki entries

### Workforce Footprint
- Work model field: In-Office / Hybrid / Virtual per location
- Geographic spread for virtual workers: Single City → Global
- Full ISO country list (195 countries)
- "Other" workforce type shows free text field

### Commerce Planning
- Pricing page: Individual $199/yr, Team $799/yr (5 seats), Corporate $2,499/yr (25 seats)
- Value strategy doc: 3 pillars (OVIX, Intelligence Briefings, Custom Agents)
- ADR-0018 (commerce tiers), ADR-0019 (value strategy)
- Founding Member program (first 100, lifetime rate lock)

### Admin
- OAuth-only admin login (Payload email/password form hidden)
- Admin bridge generates Payload JWT from NextAuth session
- Membership tiers: free/trial/practitioner/practitioner-plus

### Other
- Research paper cards: source attribution, category filtering, 15 papers updated
- API data source descriptions: operator, license, registration, cost
- Feed description keys remapped to match API IDs
- Discussion threads on articles, wiki, compass detail pages
- Articles in nav, article categories (think-tank, opinion, tutorial, etc.)

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
