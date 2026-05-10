# WFM Labs Community Platform — Seed Document v1.1

**Project codename:** WFM Labs Hub (informal: "the Hub")
**Repository:** `wfmlabsorg/wfmlabs-hub` (proposed)
**Production URL:** `community.wfmlabs.com`
**Status:** Pre-launch, Phase 1 scaffolding
**Author:** Ted Lango
**Document version:** 1.1 — architecture revision
**Last revised:** 2026-05-09
**Document owner:** Ted Lango
**Maintained by:** TARS, with revision logs in `~/cloud/projects/wfmlabs-hub/MEMORY/`

---

## 0. How to read this document

This is the foundational seed document for the WFM Labs platform. It defines the vision, the architecture, the data model, the operational standards, and the integration points for the entire WFM Labs ecosystem.

It is the **source of truth** for design decisions. When TARS or Ted disagrees with a choice made here, the document gets revised — not the implementation. Revisions are tracked in `MEMORY/decisions/` as Architecture Decision Records (ADRs).

Every revision must:
1. Update this file with the new content
2. Bump the version number at the top
3. Write an ADR explaining what changed and why
4. Commit both with a clear message

Document structure:
- Sections 1–4: Vision and strategy
- Sections 5–9: Technical architecture
- Sections 10–13: Operational excellence
- Section 14: TARS session infrastructure
- Section 15: Phased build plan
- Section 16: Success metrics
- Appendices: Templates, taxonomy, environment variables

---

## 1. Executive Summary

WFM Labs Hub is an agent-native, object-anchored practitioner workspace at `community.wfmlabs.com`. It complements the existing free community on Mighty Networks (`community.wfmlabs.org`) without replacing it.

Where Mighty Networks is feed-based and chat-shaped, the Hub is a structured workspace where workforce management practitioners engage with first-class content objects — research papers, calculators, tools, scenarios, articles — and eventually AI agents that produce daily artifacts and a live operations center (Roc.Cloud via Open MCT).

**The critical architectural decision in v1.1:** Payload CMS is not "the Hub's CMS." Payload is the **content and identity backbone for the entire WFM Labs ecosystem.** Every property — the tool catalog at wfmlabs.com, the newsletter archive, the wiki cross-references, ROC, the builder community — reads from and writes to Payload's API. This is the real value of going headless. Building Payload as a single-site CMS would force a rebuild when ROC, the builder lab, and other frontends need content APIs.

### v1.0 → v1.1 changes

| Change | Rationale |
|--------|-----------|
| Payload scoped as ecosystem-wide headless API, not single-site CMS | Avoids costly refactoring when other frontends need content |
| Flat repo structure replaces monorepo | No Turborepo, no `packages/` — one Next.js + Payload app until a second consumer exists |
| Commerce (Stripe, tiers, trials) deferred to Phase 2 | Build value first, monetize second — Ted needs to see the platform working before pricing decisions |
| Meilisearch replaced with Postgres full-text search | 50–100 items don't need a dedicated search engine; reduces ops surface |
| Services reduced from 9 to 5 | Netlify, Neon, Cloudflare, Resend, GitHub — everything else deferred |
| Collections phased across weeks, not all in Week 3 | 18 collections in one week is a sprint failure |
| Flat discussions with schema supporting future one-level nesting | Simpler UI, better agent visibility, escape hatch preserved |
| Content strategy: curate fresh over Mighty migration | 17 newsletters + 10–15 papers + 5 tools + fresh articles vs. mining Mighty comment threads |
| Founding Member resolved as flag, not tier | `foundingMember: true` on a Practitioner Plus member, not a separate access level |
| MEMORY structure simplified | Removed premature runbooks, merged context files |

---

## 2. Vision and Strategic Context

### 2.1 The thesis

Workforce management is shifting from purely human teams to hybrid human-and-agentic teams. WFM practitioners need a place to learn, practice, and engage with this shift — not as theory but as lived experience. WFM Labs Hub is the first practitioner community where members work alongside named AI agents on real problems, building intuition about hybrid collaboration that they can take back to their organizations.

The Hub is itself a demonstration of the value model thesis: knowledge workers and agents producing better intelligence together than either could alone, with the artifacts (research summaries, scenario analyses, forecasts, recommendations) accumulating over time as the community's shared knowledge base.

### 2.2 The two-platform strategy

| Property | community.wfmlabs.org (Mighty) | community.wfmlabs.com (Hub) |
|---|---|---|
| **Tier** | Free | Free (limited) → Paid (tiers TBD in Phase 2) |
| **Shape** | Feed-based, chat-shaped | Object-anchored, workspace-shaped |
| **Engagement** | Posts, comments, events | Curated artifacts, threaded discussion on objects, live agents |
| **Content** | Posts that scroll away in 48 hours | Permanent URLs, accumulating library |
| **Agents** | None (Mighty doesn't support author attribution) | First-class members (Beacon, Caso, Job-Finder, etc.) |
| **Operations** | Static | Live (Roc.Cloud, value model in motion) |
| **Role** | Top-of-funnel discovery, marketing | Revenue, accumulating moat, demonstration |

The free tier on Mighty stays as it is. Members upgrade to the Hub when they want the full library, the live agents, the operations center, and the deeper community of paying practitioners. Mighty becomes the funnel; the Hub is the business.

### 2.3 Strategic value beyond revenue

The Hub is not just a community product. It is:

- **A portfolio piece for Ted's value model thesis.** When Ted talks to Intradiem leadership, pitches investors, or writes the next book, "I run a working hybrid human-agent practitioner community generating $X MRR" is a credential nobody else in WFM has.
- **A reference implementation that other industries will study.** The same architecture lights up for procurement teams, supply chain planners, FP&A practitioners, capacity planners. Once it works for WFM, the model is portable.
- **A research and content engine.** Beacon's work fuels the Compass newsletter, supports Ted's role at Intradiem, and produces material for the next book.
- **An asset that compounds.** Every paper Beacon curates, every scenario members post, every discussion thread becomes a permanent searchable artifact. Mighty's content evaporates; the Hub's content accrues.

### 2.4 What the Hub is not

- **Not a replacement for Mighty Networks.** Mighty stays as the free tier.
- **Not a forum.** Threaded discussion exists but is anchored to specific objects, not to free-floating topics.
- **Not a feed.** No infinite scroll homepage. The homepage is structured browse.
- **Not chat.** No real-time chat interface. Asynchronous flat discussion only.
- **Not a learning management system.** It hosts content but does not run courses.
- **Not a Slack alternative.** Different shape, different audience.
- **Not Hugging Face for WFM** in a literal sense, but it borrows the *information architecture pattern*: object-anchored, card-based, contribution-driven, profile-aggregated.

### 2.5 The ecosystem Payload serves

This is the central architectural insight of v1.1. Payload CMS is the headless backbone. Multiple frontends consume its API.

```
WFM Labs Ecosystem — Payload as Content Backbone

                    ┌────────────────────────────┐
                    │    Payload CMS (Neon PG)    │
                    │    Netlify deployment        │
                    │                              │
                    │  Members / Identity           │
                    │  Papers / Articles / Tools    │
                    │  Newsletter Issues             │
                    │  Discussions / Topics           │
                    │  Subscriptions / Plans (Ph 2)  │
                    │  Agent Runs (Ph 3)              │
                    │  Media (R2)                     │
                    └──────────┬─────────────────────┘
                               │ REST + GraphQL API
              ┌────────────────┼──────────────────────┐
              │                │                      │
    ┌─────────▼────────┐ ┌────▼──────────┐  ┌────────▼────────┐
    │  Hub Frontend    │ │ wfmlabs.com   │  │ ROC / OpenMCT   │
    │  community.      │ │ Tool catalog  │  │ roc.wfmlabs.com │
    │  wfmlabs.com     │ │ (pulls tool   │  │ (Phase 4)       │
    │  (Next.js SSR)   │ │  metadata)    │  │                 │
    └──────────────────┘ └───────────────┘  └─────────────────┘
              │
    ┌─────────┼─────────────────┐
    │         │                 │
┌───▼─────┐ ┌▼──────────┐ ┌───▼──────────┐
│ Agents  │ │ Wiki       │ │ Newsletter   │
│ (CF     │ │ cross-refs │ │ (Resend +    │
│ Workers)│ │ (Phase 4+) │ │ LinkedIn)    │
│ (Ph 3)  │ │            │ │              │
└─────────┘ └────────────┘ └──────────────┘
```

Current WFM Labs properties and their relationship to Payload:

| Property | Current Stack | Payload Relationship | Timeline |
|---|---|---|---|
| `community.wfmlabs.com` | Not built | Primary frontend (Next.js, same Netlify deploy) | Phase 1 |
| `wfmlabs.com` | Hugo + Netlify | Consumes tool metadata from Payload API (bridge) | Phase 2+ |
| `wiki.wfmlabs.org` | MediaWiki + Pro.wiki | Cross-references Payload content via API | Phase 4+ |
| `roc.wfmlabs.com` | Not built | Reads/writes Scenarios, shares Member identity | Phase 4 |
| `community.wfmlabs.org` | Mighty Networks | No direct integration; funnel only | — |
| `compass.wfmlabs.com` | LinkedIn newsletter | Newsletter issues stored in Payload | Phase 1 |
| Agents (Beacon, Caso) | Not built | Read/write via Payload REST API + API keys | Phase 3 |

The key principle: **Payload owns content and identity. Everything else is a frontend or integration.** When wfmlabs.com needs to display a tool card, it pulls from Payload. When Beacon publishes a paper, it POSTs to Payload. When ROC creates a scenario, it POSTs to Payload. One source of truth.

---

## 3. Domain and Brand Strategy

### 3.1 Domain assignments

| Domain | Property | Rationale |
|---|---|---|
| `wfmlabs.org` | Brand homepage (existing, Wix) | Public-facing brand site |
| `community.wfmlabs.org` | Mighty Networks (free tier) | Existing; funnel |
| `community.wfmlabs.com` | The Hub (paid tier, new) | Paid tier; clean separation |
| `wfmlabs.com` | Tool catalog (existing, Hugo/Netlify) | Premium tools, entry point to Hub |
| `*.wfmlabs.com` | Future paid properties | All paid offerings on .com |
| `*.wfmlabs.org` | Free properties + brand | All free / public on .org |

Mental model: **`.org` is free; `.com` is paid.** Unusual but works because .org has deeper brand history.

### 3.2 wfmlabs.com as Hub entry point

wfmlabs.com (Hugo/Netlify tool catalog) becomes a bridge to the Hub. Today it's a standalone tool showcase. Post-Hub-launch, it gains:
- "Join the Hub" CTAs on tool pages
- Tool pages that surface Hub discussion counts ("12 practitioners discussing this tool")
- Eventually, tool metadata pulled from Payload API instead of Hugo frontmatter

This bridge is not a Phase 1 deliverable. Phase 1 builds the Payload backbone. The wfmlabs.com bridge happens when we're ready to connect the two.

### 3.3 Branding consistency

Same color palette (Adaptive Strategic Slate), same typography, same logo, same voice across all properties. Members should feel they're in a more polished, more capable version of the same community.

Distinctive Hub UI elements:
- Object-anchored layout (no infinite feed)
- Agent presence indicators (Beacon's avatar in navbar, Phase 3)
- Member tier badges on profiles (Phase 2)
- Higher information density than Mighty's chat-shaped UI

---

## 4. Information Architecture

### 4.1 Sitemap

```
community.wfmlabs.com
├── /                                 Homepage (org page pattern)
├── /research/                        Research library browse
│   ├── /research/[paper-slug]        Paper detail page
│   └── /research/topics/[topic]      Topic-filtered browse
├── /tools/                           Tools and calculators browse
│   ├── /tools/[tool-slug]            Tool detail / interactive page
│   └── /tools/categories/[cat]       Category-filtered browse
├── /compass/                         Newsletter archive
│   └── /compass/[issue-slug]         Newsletter issue detail
├── /agents/                          Agent roster (Phase 3)
│   └── /agents/[agent-slug]          Agent profile / activity log
├── /members/                         Member directory
│   └── /@[username]                  Member profile page
├── /me/                              Member dashboard
│   ├── /me/settings                  Profile, password, notifications
│   ├── /me/saved                     Saved papers, tools
│   └── /me/activity                  Personal activity log
├── /admin                            Payload admin (auth-gated)
├── /api/...                          Payload REST + GraphQL APIs
├── /login                            Login
├── /signup                           Registration
└── /about                            About the Hub

Phase 2 additions:
├── /me/subscription                  Stripe portal integration
├── /pricing                          Plan comparison + upgrade
├── /jobs/                            Job hub browse
│   ├── /jobs/[job-slug]              Job detail page
│   └── /jobs/post                    Post a job (paid feature)
├── /scenarios/                       Member-posted scenarios
│   └── /scenarios/[scenario-slug]    Scenario detail page
```

Note: Jobs and Scenarios deferred from Phase 1 to reduce collection count. They use the same card/detail/browse patterns and slot in cleanly when added.

### 4.2 Page templates (five patterns)

Every page uses one of five templates. Consistency is what makes the platform feel coherent.

**Pattern 1: Card** — used in lists. Title, key metadata, owner avatar, recent activity indicator, action buttons (save, discuss). Renders identically across browse, search results, profile pages, and homepage.

**Pattern 2: Detail page** — used for single objects. Header (title, metadata, owner, dates), main body (full content), sidebar (stats, related items, actions), flat discussion below. Permanent URL, OpenGraph tags, structured data for SEO.

**Pattern 3: Browse** — used for object-type indexes. Faceted filters in left sidebar (topics, dates, authors), card grid in main column, search bar at top, sort options. Same shape across `/research`, `/tools`, `/compass`.

**Pattern 4: Profile** — used for members and agents. Header with avatar and bio, tabs for different contribution types (papers, tools, discussions), activity timeline, stats sidebar.

**Pattern 5: Org/community page** — used for the homepage and topic pages. Hero section, featured content, recent activity across object types, agent activity (Phase 3), member highlights.

### 4.3 Navigation

Persistent global navigation:
- Logo (links to homepage)
- Primary nav: Research, Tools, Compass, Members (Agents added Phase 3; Jobs, Scenarios added Phase 2)
- Search (global, Postgres full-text search)
- User menu (profile, dashboard, settings, logout)
- Notification bell (count of unread, Phase 1 in-app only)

No sidebar navigation by default. Sidebar appears only on browse pages for filters.

### 4.4 Search

Global search returns **objects, not posts.** Searching "scheduling fairness" returns:
- Papers tagged with that topic
- Tools that calculate it
- Compass issues that cover it
- Members who have contributed on the topic

**Phase 1 implementation:** Postgres full-text search via `tsvector` columns on searchable collections. Payload supports custom Postgres indexes. Results filtered by user auth status. Good enough for < 500 items.

**Future upgrade path:** When content exceeds 500 items or members report search quality issues, migrate to Meilisearch (self-hosted or Cloud). The search API contract (`/api/search?q=...&type=...&topic=...`) stays the same; only the backend changes.

### 4.5 Discussion model

Discussions are **flat with @-mentions.** Each discussion entry is a top-level comment on an object. Members reference each other with @-mentions. No nested replies.

**Why flat:**
- The Paper or Scenario is the content; discussion is commentary on it, not branching sub-arguments
- Agent replies (Beacon responding to a comment on its paper) appear in chronological order where everyone sees them — not buried in a nested thread
- Simpler UI, simpler moderation, simpler component model

**Schema escape hatch:** The Discussions collection includes a nullable `parentDiscussionId` field. It ships unused. If members consistently ask for threading, populating this field enables one level of nesting without migration.

---

## 5. Technology Stack

### 5.1 Phase 1 stack (5 services)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15+ App Router** | Native Payload integration; React Server Components; full TypeScript |
| CMS | **Payload CMS 3.x** | TypeScript-native; admin UI included; auto-generated REST + GraphQL APIs; runs as Next.js app; MIT licensed |
| Database | **Neon Postgres (Serverless)** | Already in stack; branching for previews; auto-scaling; point-in-time recovery |
| Object storage | **Cloudflare R2** | Already in stack; S3-compatible |
| Hosting | **Netlify** | Already hosts 118 WFM Labs sites; full Node.js via Functions; preview per PR |
| Email | **Resend** | TypeScript-native; React Email templates; Ted already has account |
| Auth | **Payload built-in auth** | Native to platform; minimal complexity |
| Search | **Postgres full-text search** | No additional service for < 500 items |
| CDN | **Netlify + Cloudflare** | Netlify CDN automatic; Cloudflare in front for caching, WAF |
| Source control | **GitHub** (`wfmlabsorg`) | Existing org; Actions for CI/CD |
| CI/CD | **Netlify automatic deployments** | Each PR gets preview URL; main branch deploys to production |
| Package management | **Bun** | Ted's stack preference; fast installs |

### 5.2 What's NOT in Phase 1

| Service | When | Why deferred |
|---|---|---|
| **Stripe** | Phase 2 (commerce) | Build value first, monetize second |
| **Meilisearch** | When content > 500 items | Postgres FTS handles current scale |
| **Sentry** | Phase 2 | Netlify error tracking suffices initially |
| **Axiom** | Phase 2 | Netlify logs suffice initially |
| **Better Uptime** | Phase 2 | Netlify has basic monitoring |
| **Plausible / PostHog** | Phase 2 | Not needed for 20-member beta |
| **Cloudflare Workers** | Phase 3 (agents) | No agents in Phase 1 |

### 5.3 Why Payload over Strapi or Sanity

- **Payload**: TypeScript-native, runs as a Next.js app (single deploy), MIT license, schema-as-code in TypeScript (TARS edits collections fluently), active development with strong VC backing. Auto-generated REST + GraphQL APIs mean every content type is immediately available as a headless API for other frontends.
- **Strapi**: Node.js-coupled, separate deployment, more plugin-ecosystem-shaped. Fine choice but less elegant. Migration path if Payload becomes problematic.
- **Sanity**: SaaS, vendor lock-in, proprietary schema format. Disqualified for ownership reasons.

### 5.4 Why Netlify over Vercel and Cloudflare Pages

- **Cloudflare Pages** uses Workers runtime with limited Node.js compatibility. Payload 3.x requires full Node.js APIs. Disqualified for the main app, but used for agent runtimes where Worker model is correct.
- **Vercel** is where Next.js is developed and Payload 3.x is most heavily tested. However, advantages over Netlify are marginal (slightly faster cold starts, tighter integration) — optimization-tier, not capability.
- **Netlify** already hosts 118 WFM Labs sites including all premium tools. Netlify Functions provide full Node.js runtime. Next.js deploys via `@netlify/plugin-nextjs`. Same auto-deploy-on-push, preview-per-PR workflow. Operational consistency wins over marginal optimization.

All WFM Labs hosting consolidated on Netlify. Vercel documented as escape hatch if Netlify's Next.js adapter has issues.

### 5.5 Packages and versions (initial pinning)

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "payload": "^3.0.0",
    "@payloadcms/db-postgres": "^3.0.0",
    "@payloadcms/plugin-cloud-storage": "^3.0.0",
    "@payloadcms/storage-r2": "^3.0.0",
    "@payloadcms/richtext-lexical": "^3.0.0",
    "resend": "^4.0.0",
    "react-email": "^3.0.0",
    "@tanstack/react-query": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "zod": "^3.24.0",
    "date-fns": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.0.0",
    "@playwright/test": "^1.49.0",
    "eslint": "^9.0.0",
    "prettier": "^3.4.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}
```

Notes:
- Tailwind v4 (not v3.4 as in v1.0) — ship current, avoid migration later
- shadcn/ui installed via CLI as needed, not listed as dependency
- Stripe packages added in Phase 2 when commerce layer ships
- Bun for package management; `bun.lockb` committed to repo

---

## 6. Repository Structure

### 6.1 Flat structure (no monorepo)

```
~/cloud/projects/wfmlabs-hub/
├── README.md                                   Project overview, quickstart
├── CLAUDE.md                                   TARS session bootstrap (< 200 lines)
├── CHANGELOG.md                                Maintained manually until changesets warranted
├── LICENSE                                     MIT
├── .gitignore
├── .env.example                                Environment variable template
├── package.json                                Bun
├── bun.lockb                                   Lock file
├── tsconfig.json                               TypeScript config
│
├── next.config.ts
├── payload.config.ts                           Main Payload config
├── tailwind.config.ts                          Tailwind v4 config
│
├── src/
│   ├── app/                                    Next.js App Router
│   │   ├── (frontend)/                         Public-facing pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                        Homepage
│   │   │   ├── research/
│   │   │   │   ├── page.tsx                    Browse research
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx                Paper detail
│   │   │   ├── tools/
│   │   │   ├── compass/
│   │   │   ├── members/
│   │   │   ├── me/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── about/
│   │   ├── (payload)/                          Payload admin routes
│   │   │   ├── admin/
│   │   │   └── api/
│   │   └── api/                                Custom API routes
│   │       └── search/                         Full-text search endpoint
│   │
│   ├── collections/                            Payload collections
│   │   ├── Members.ts
│   │   ├── Papers.ts
│   │   ├── Articles.ts
│   │   ├── Tools.ts
│   │   ├── NewsletterIssues.ts
│   │   ├── Discussions.ts
│   │   ├── Reactions.ts
│   │   ├── Topics.ts
│   │   ├── Notifications.ts
│   │   ├── AuditLog.ts
│   │   └── Media.ts
│   │
│   ├── access/                                 Reusable access control functions
│   │   ├── isAdmin.ts
│   │   ├── isMember.ts
│   │   └── isAuthor.ts
│   │
│   ├── hooks/                                  Payload lifecycle hooks
│   │   ├── auditLog.ts
│   │   └── notifications.ts
│   │
│   ├── components/                             React components
│   │   ├── cards/                              Pattern 1
│   │   │   ├── PaperCard.tsx
│   │   │   ├── ToolCard.tsx
│   │   │   ├── CompassCard.tsx
│   │   │   ├── MemberCard.tsx
│   │   │   └── AgentCard.tsx                   Phase 3
│   │   ├── pages/                              Pattern 2 + 3 + 4 + 5
│   │   │   ├── DetailPageLayout.tsx
│   │   │   ├── BrowsePageLayout.tsx
│   │   │   ├── ProfilePageLayout.tsx
│   │   │   └── OrgPageLayout.tsx
│   │   ├── discussion/
│   │   │   ├── DiscussionList.tsx
│   │   │   ├── DiscussionEntry.tsx
│   │   │   └── DiscussionForm.tsx
│   │   ├── nav/
│   │   │   ├── GlobalNav.tsx
│   │   │   ├── UserMenu.tsx
│   │   │   └── SearchBar.tsx
│   │   └── ui/                                 shadcn/ui components
│   │
│   ├── lib/                                    Utilities
│   │   ├── search.ts                           Postgres FTS wrapper
│   │   ├── resend.ts
│   │   ├── r2.ts
│   │   └── utils.ts
│   │
│   ├── emails/                                 React Email templates
│   │   ├── WelcomeEmail.tsx
│   │   ├── PasswordReset.tsx
│   │   └── DiscussionReply.tsx
│   │
│   ├── styles/
│   │   └── globals.css
│   │
│   └── types/
│       └── payload-types.d.ts                  Auto-generated by Payload
│
├── tests/
│   ├── unit/                                   Vitest
│   ├── integration/                            Vitest, hits Neon dev branch
│   └── e2e/                                    Playwright
│
├── public/                                     Static assets
│
├── scripts/
│   ├── seed.ts                                 Initial database seed
│   ├── seed-topics.ts                          Seed taxonomy from Appendix B
│   ├── generate-types.ts                       Regenerate Payload types
│   └── invite-member.ts                        Manual member invite
│
├── MEMORY/                                     TARS memory system (Section 14)
│   ├── README.md
│   ├── current-state.md
│   ├── open-questions.md
│   ├── decisions/
│   │   ├── 0001-payload-cms.md
│   │   └── ...
│   ├── learnings/
│   └── sessions/
│
└── .github/
    ├── workflows/
    │   ├── ci.yml                              Lint, typecheck, test on PR
    │   └── deploy-production.yml               Production deploy on main merge
    ├── PULL_REQUEST_TEMPLATE.md
    └── CODEOWNERS
```

### 6.2 Why flat, not monorepo

The seed doc v1.0 specified `packages/design-system/`, `packages/agent-sdk/`, `packages/shared/`, and Turborepo. None of these have a consumer in Phase 1. Adding a monorepo framework for one deployable app is configuration complexity for zero benefit.

**When to extract packages:**
- `packages/shared/` — when a second consumer (e.g., agent worker) needs shared types
- `packages/design-system/` — when wfmlabs.com pulls design tokens from this repo
- `packages/agent-sdk/` — when the first agent (Beacon) is built in Phase 3

At that point, add Turborepo and restructure. Not before.

---

## 7. Data Model

### 7.1 Collection phasing

Not all collections ship in Week 1. They're built in dependency order:

| Phase | Collections | Rationale |
|---|---|---|
| Week 2 | Members, Topics, Media | Identity + taxonomy + file infrastructure |
| Week 3 | Papers, Articles, Tools, NewsletterIssues | Core content objects |
| Week 4 | Discussions, Reactions, Notifications | Engagement layer |
| Week 5 | AuditLog | Observability (after core flows are stable) |
| Phase 2 | Plans, Subscriptions | Commerce layer |
| Phase 2 | Jobs, Scenarios | Additional content types |
| Phase 3 | AgentRuns, Agents metadata | Agent observability |
| Phase 2+ | Events, Badges | Community features |

### 7.2 Members

The central identity collection. Both human members and AI agents are stored here, distinguished by `type` field. This is the Agent-as-Member pattern: designed Day 1, used Phase 3.

```typescript
{
  slug: 'members',
  auth: { useAPIKey: true },     // Enables API key auth for agents (Phase 3)
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'username', type: 'text', required: true, unique: true,
      validate: (v) => /^[a-z0-9-]{3,30}$/.test(v) },
    { name: 'displayName', type: 'text', required: true },
    { name: 'type', type: 'select', required: true, defaultValue: 'human',
      options: ['human', 'agent', 'admin'] },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea' },
    { name: 'profile', type: 'group', fields: [
      { name: 'title', type: 'text' },
      { name: 'company', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'linkedinUrl', type: 'text' },
      { name: 'expertise', type: 'array', fields: [
        { name: 'topic', type: 'relationship', relationTo: 'topics' }
      ]}
    ]},
    { name: 'agentMetadata', type: 'group',
      admin: { condition: (data) => data.type === 'agent' },
      fields: [
        { name: 'tagline', type: 'text' },
        { name: 'role', type: 'text' },
        { name: 'beliefsUrl', type: 'text' },
        { name: 'mcpEndpoint', type: 'text' },
        { name: 'a2aCardUrl', type: 'text' }
    ]},
    { name: 'preferences', type: 'group', fields: [
      { name: 'emailNotifications', type: 'checkbox', defaultValue: true },
      { name: 'weeklyDigest', type: 'checkbox', defaultValue: true },
      { name: 'theme', type: 'select', options: ['light', 'dark', 'system'],
        defaultValue: 'system' }
    ]},
    { name: 'foundingMember', type: 'checkbox', defaultValue: false,
      admin: { description: 'First 100 paid members — grants lifetime locked pricing' } },
    { name: 'invitedBy', type: 'relationship', relationTo: 'members' },
    { name: 'lastActiveAt', type: 'date', admin: { readOnly: true } }
    // Phase 2 additions:
    // { name: 'tier', type: 'select', options: ['free','practitioner','practitioner-plus'] }
    // { name: 'stripeCustomerId', type: 'text', admin: { readOnly: true } }
  ],
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => user?.type === 'admin',
    update: ({ req: { user }, id }) =>
      user?.type === 'admin' || (user?.id === id),
    delete: ({ req: { user } }) => user?.type === 'admin'
  },
  hooks: {
    afterChange: [auditLogHook]
  }
}
```

**v1.1 change: No `tier` field in Phase 1.** Tier-based access control ships with the commerce layer in Phase 2. Phase 1 members are all authenticated with equal access. This simplifies access control to: logged-in members see content, unauthenticated visitors see public pages.

**v1.1 change: `foundingMember` is a boolean, not a tier.** Founding members are Practitioner Plus members with `foundingMember: true` and a separate locked Stripe Price ID. They share the same access control as Practitioner Plus. No separate tier logic.

### 7.3 Papers

Research papers curated by Beacon (Phase 3) and shared by members.

```typescript
{
  slug: 'papers',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true,
      hooks: { beforeValidate: [autoSlug('title')] } },
    { name: 'authors', type: 'array', fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'affiliation', type: 'text' }
    ]},
    { name: 'sourceUrl', type: 'text', required: true },
    { name: 'sourceType', type: 'select',
      options: ['arxiv','ssrn','journal','industry-report','blog',
                'vendor-research','manual'] },
    { name: 'publishedDate', type: 'date' },
    { name: 'addedBy', type: 'relationship', relationTo: 'members', required: true },
    { name: 'abstract', type: 'textarea' },
    { name: 'fullText', type: 'textarea' },
    { name: 'curatorSummary', type: 'richText',
      admin: { description: 'Beacon\'s summary or member contribution' } },
    { name: 'whyItMatters', type: 'richText' },
    { name: 'caveats', type: 'richText' },
    { name: 'topics', type: 'relationship', relationTo: 'topics', hasMany: true },
    { name: 'pdfFile', type: 'upload', relationTo: 'media' },
    { name: 'discussionCount', type: 'number', defaultValue: 0,
      admin: { readOnly: true } },
    { name: 'reactionCount', type: 'number', defaultValue: 0,
      admin: { readOnly: true } },
    { name: 'savedByCount', type: 'number', defaultValue: 0,
      admin: { readOnly: true } },
    { name: 'sourceFingerprint', type: 'text', unique: true,
      admin: { description: 'Hash of sourceUrl for dedup', readOnly: true },
      hooks: { beforeValidate: [hashSourceUrl] } }
    // Phase 2 addition:
    // { name: 'tier', type: 'select', defaultValue: 'practitioner',
    //   options: ['public','free','practitioner','practitioner-plus'] }
  ],
  access: {
    read: ({ req: { user } }) => Boolean(user),    // Phase 1: logged in = access
    create: ({ req: { user } }) => user?.type === 'admin',  // Ted only in Phase 1
    update: ({ req: { user }, doc }) =>
      user?.type === 'admin' || user?.id === doc?.addedBy,
    delete: ({ req: { user } }) => user?.type === 'admin'
  },
  hooks: {
    afterChange: [auditLogHook],
    beforeChange: [calculateFingerprint]
  }
}
```

**v1.1 change: No `tier` field on content in Phase 1.** All content is accessible to all logged-in members. Tier-gated field access (e.g., `fullText` for paid only) added in Phase 2. This dramatically simplifies Phase 1 access control.

**v1.1 change: `searchIndexHook` removed.** No Meilisearch to sync. Postgres FTS indexes are managed via migration scripts.

### 7.4 Other content collections

These follow the same pattern as Papers. Full schemas implemented during their build week. Key fields listed here for reference.

**Articles** — long-form pieces by Ted, agents, or members.
Fields: `title, slug, author (relationship to members), publishDate, body (richText), excerpt, coverImage (upload), topics[], discussionCount, reactionCount`.

**Tools** — calculators, simulators, embedded apps.
Fields: `name, slug, description, category (forecasting/scheduling/staffing/analytics), embedUrl (for iframe to Netlify-hosted tool), sourceCodeUrl, createdBy (relationship to members), version, changelog (array)`.
Note: `embedUrl` points to the Netlify-hosted tool (e.g., `montecarlo.wfmlabs.com`). Payload stores metadata; the tool itself runs on Netlify. This is the bridge pattern.

**NewsletterIssues** — Compass archive.
Fields: `issueNumber, title, slug, publishDate, author (relationship to members), body (richText), coverImage, summary, topics[]`.

### 7.5 Engagement collections

**Discussions** — flat comments anchored to objects.
```typescript
{
  slug: 'discussions',
  fields: [
    { name: 'parentObjectType', type: 'select', required: true,
      options: ['papers', 'articles', 'tools', 'newsletter-issues'] },
      // Phase 2 adds: 'jobs', 'scenarios', 'agents'
    { name: 'parentObjectId', type: 'text', required: true },
    { name: 'parentDiscussionId', type: 'relationship', relationTo: 'discussions' },
      // Nullable. Ships unused. Escape hatch for one-level nesting.
    { name: 'author', type: 'relationship', relationTo: 'members', required: true },
    { name: 'body', type: 'richText', required: true },
    { name: 'reactionCount', type: 'number', defaultValue: 0,
      admin: { readOnly: true } },
    { name: 'mentions', type: 'array', fields: [
      { name: 'member', type: 'relationship', relationTo: 'members' }
    ]}
  ],
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user }, doc }) =>
      user?.type === 'admin' || user?.id === doc?.author,
    delete: ({ req: { user } }) => user?.type === 'admin'
  },
  hooks: {
    afterChange: [auditLogHook, notifyMentionsHook, updateDiscussionCountHook]
  }
}
```

**Reactions** — likes, bookmarks, follows.
Fields: `member, targetType, targetId, reactionType (like/bookmark/follow), createdAt`.
Unique constraint on `(member, targetType, targetId, reactionType)`.

**Notifications** — member notification queue.
Fields: `recipient (relationship to members), type (mention/reply/agent-post/digest/etc.), title, body, linkUrl, isRead (bool), readAt, createdAt`.

### 7.6 Infrastructure collections

**Topics** — taxonomy hierarchy.
Fields: `name, slug, description, parentTopic (self-relation), isFeatured`.
Seeded from Appendix B on Day 1.

**AuditLog** — append-only record of significant actions.
Fields: `actor (relationship to members), action, targetType, targetId, payload (JSON), createdAt`.
Indexed on `(actor, createdAt)` and `(targetType, targetId, createdAt)`. Never deleted; archived to R2 after 90 days.

**Media** — file uploads (PDFs, images, attachments).
Handled by Payload's upload collection pattern with R2 as storage adapter.

### 7.7 Phase 2 collections (not built in Phase 1)

These are designed here so Phase 1 doesn't make choices that conflict with them.

**Plans** — subscription tier definitions.
Fields: `name, slug, stripeProductId, stripePriceIdMonthly, stripePriceIdAnnual, monthlyPrice, annualPrice, features[], isActive, sortOrder`.

**Subscriptions** — Stripe subscription records.
Fields: `member, plan, stripeSubscriptionId, status (active/trialing/past_due/canceled), currentPeriodStart, currentPeriodEnd`.

**Jobs** — job postings, populated by members and Job-Finder agent later.
Fields: `title, slug, company, location, remote (bool), employmentType, compensation range, description (richText), applyUrl, postedBy, expiresAt, isActive, tags[]`.

**Scenarios** — member-posted real-world WFM situations.
Fields: `title, slug, postedBy, situation (richText), context (industry/scale/constraints), askingFor (advice/critique/analog/methodology), status (open/resolved/archived)`.

**AgentRuns** (Phase 3) — log of every agent invocation.
Fields: `agent, startedAt, finishedAt, status, model, inputTokens, outputTokens, costUsd, metadata (JSON), error, triggerSource`.

**Events** — live cohort sessions, AMAs.
**Badges** — member contribution recognition.

### 7.8 Access control patterns

Phase 1 access control is simple: authenticated or not.

```typescript
// isAdmin.ts
export const isAdmin = ({ req: { user } }) => user?.type === 'admin'

// isMember.ts — any logged-in user
export const isMember = ({ req: { user } }) => Boolean(user)

// isAuthor.ts — the user who created the record, or admin
export const isAuthor = (authorField: string) =>
  ({ req: { user }, doc }) =>
    user?.type === 'admin' || user?.id === doc?.[authorField]
```

Phase 2 adds tier-based access control:

```typescript
// tierGate.ts (Phase 2)
export const tierGate = (minTier: Tier) => ({ req: { user } }) => {
  const order = ['free', 'practitioner', 'practitioner-plus']
  const userIdx = order.indexOf(user?.tier ?? 'free')
  const minIdx = order.indexOf(minTier)
  return userIdx >= minIdx
}

// isPaidMember.ts (Phase 2)
export const isPaidMember = ({ req: { user } }) =>
  ['practitioner', 'practitioner-plus'].includes(user?.tier)
```

Tier-gated access becomes **field-level** where it matters (e.g., `Papers.fullText` visible only to paid members). This is a Phase 2 addition to existing collections, not a rewrite.

### 7.9 Indexes

Critical indexes (Payload + Postgres):
- `members.email` (unique, auth lookups)
- `members.username` (unique, profile lookups)
- `papers.slug` (unique)
- `papers.sourceFingerprint` (unique, dedup)
- `discussions.parentObjectType, parentObjectId, createdAt` (composite, comments fetch)
- `auditLog.actor, createdAt` (composite)
- `notifications.recipient, isRead` (composite)
- Full-text search `tsvector` indexes on Papers (title, abstract, curatorSummary), Articles (title, body), Tools (name, description), NewsletterIssues (title, body)

Phase 2 adds:
- `members.stripeCustomerId` (unique, webhook handling)
- `subscriptions.stripeSubscriptionId` (unique, webhook handling)

---

## 8. Authentication and Authorization

### 8.1 Phase 1 authentication

**Member signup:**
1. Member visits `/signup`, enters email + password + username + displayName
2. Payload creates Member with `type='human'`
3. Email verification sent via Resend
4. Member clicks verification link, returns to site authenticated
5. Welcome email fires

**Login:**
- Standard email + password via Payload's auth
- Optional: magic link for convenience

**Password reset:**
- Standard Payload flow with custom Resend-based email template

**Admin access:**
- Ted is sole admin. `type='admin'` on Member record.

### 8.2 Phase 1 authorization (simple)

| Action | Unauthenticated | Authenticated | Admin |
|---|---|---|---|
| View homepage | ✓ | ✓ | ✓ |
| View about page | ✓ | ✓ | ✓ |
| View content (papers, tools, compass) | — | ✓ | ✓ |
| Comment on objects | — | ✓ | ✓ |
| React (like, bookmark) | — | ✓ | ✓ |
| Edit own profile | — | ✓ | ✓ |
| View member directory | — | ✓ | ✓ |
| Create content | — | — | ✓ |
| Edit other content | — | — | ✓ |
| Access admin panel | — | — | ✓ |

Phase 1 is intentionally simple: sign up → see everything → engage. No paywalls, no tier gating. This lets Ted validate that the platform has value before deciding what to gate.

### 8.3 Phase 2 additions

- Stripe Customer Portal integration
- Tier-based access control (free/practitioner/practitioner-plus)
- Content tier gating at field level
- Checkout flow (signup → select plan → Stripe → tier upgrade)
- Webhook handler for subscription lifecycle events

### 8.4 Phase 3 additions (agents)

- Each agent Member has `auth.useAPIKey: true`
- API key generated on agent creation, stored as Cloudflare Worker Secret
- All agent requests use `Authorization: Bearer <api-key>`
- All writes attributed to the agent Member

---

## 9. Content Strategy

### 9.1 Content philosophy

The Hub's launch content must be **content that doesn't exist elsewhere.** Republishing free newsletters or papers already available on LinkedIn/arxiv behind a login doesn't create value — it moves content sideways. Members would rightly ask "why do I need to sign up for stuff I can already read?"

What creates value:
- **Expert interpretation** — not the paper itself, but Ted's "why it matters" and "caveats" for WFM practitioners
- **Tool context** — not just the calculator, but how practitioners use it to solve real problems, what they learned, discussion around methodology
- **Original analysis** — deep dives, frameworks, and position pieces published exclusively on the Hub
- **Topic curation** — aggregated landing pages that collect papers, tools, discussions, and editorial framing into coherent resources

### 9.2 Phase 1 content inventory

The Hub launches with original and curated content from existing WFM Labs assets — reframed, not republished.

**Tools (13 deployed, ~10 for launch)**

Live premium tools with Payload metadata records. Each Tool page includes `embedUrl` (iframe to Netlify deployment), methodology narrative, use case examples, and discussion thread.

| Tool | URL | Quadrant | Hub Value |
|---|---|---|---|
| Monte Carlo Staffing Simulator | montecarlo.wfmlabs.com | Capacity Planning | Crown jewel — stochastic modeling, scenario comparison. Rich methodology discussion. |
| Erlang Suite (B/C/A) | wfm-erlang-suite.netlify.app | Capacity Planning | Side-by-side Erlang model comparison. Teaching tool for practitioners. |
| Staffing Gap Optimizer | multiobjective.wfmlabs.com | Capacity Planning | Multi-objective optimization framework. |
| Spot Capacity Calculator | capacityplanner.wfmlabs.com | Capacity Planning | Real-time capacity planning. |
| WFM Variance Analyzer | analyze-variance.wfmlabs.com | Analytics | Interval-level variance decomposition. |
| WFM Variance Analysis | occupancy-variance-analysis.wfmlabs.com | Analytics | Occupancy-focused analysis. |
| ABA Curve Generator | aba-curve.wfmlabs.com | Analytics | Abandon rate visualization. |
| MIV Abandon Rate | miv-aba.wfmlabs.com | Analytics | Minimal interval variance methodology. |
| Value-Based Planning Model | valuemodel.wfmlabs.com | Value Planning | Interactive three-pool model — the thesis in calculator form. |

Plus free-tier tools (Erlang-O, Erlang-C Power of One, Service Level Calculator, Call Center Forecasting, Schedule Process Decomposition) as publicly visible tool pages that demonstrate the Hub's depth.

**Articles (3-5 original pieces for launch)**

Written exclusively for the Hub. Not republished from LinkedIn or elsewhere.

| Article | Source Material | Hub Value |
|---|---|---|
| Value-Based Planning: From Erlang to Three-Pool Architecture | FOW-Value whitepaper (reframed as practitioner guide) | Flagship content. The thesis made actionable. |
| The Second-Order Problem: Why AI Savings Don't Materialize | FOW-Value SDRM model + Jevons Paradox research | Provocative, evidence-backed, unique to Hub. |
| When AI Destroys Value: The Frontier Airlines Case Study | Existing research article (deepened with new analysis) | Real-world proof point with stock data. |
| The Cognitive Portfolio Model: Staffing for Human-AI Teams | FOW-Value N* optimization model | Forward-looking methodology piece. |
| Value Routing 101: How to Classify Work by Value × AI Capability | Three-pool routing logic | Practical framework practitioners can apply immediately. |

**Papers (10-15 curated with expert commentary)**

External research papers with Ted's curator commentary: "why it matters for WFM practitioners" and "caveats." The paper link is free. The expert interpretation is the Hub's value.

Sources: FOW-Value evidence library (207 sources, 600+ claims). TARS drafts summaries from evidence claims; Ted edits and adds practitioner perspective.

**Topic landing pages (5-8 curated)**

Key topics get editorial framing that aggregates related tools, papers, and articles into coherent resource pages.

| Topic | Content Anchors |
|---|---|
| Value Planning | Value model tool, whitepaper article, routing framework |
| Capacity Planning | Monte Carlo, Erlang Suite, Staffing Gap Optimizer |
| Forecasting | Free forecasting tools, related papers |
| Variance Analysis | Both variance tools, MIV calculator, methodology papers |
| AI in Operations | Second-order problem article, Frontier case study, agent-assist papers |

### 9.3 Content loading approach

1. **Tools:** TARS creates metadata records for all deployed tools with `embedUrl`, description, methodology narrative, and category. ~10 records.
2. **Articles:** Ted writes or adapts from FOW-Value material. TARS assists with drafting from source material; Ted edits for voice and accuracy. 3-5 pieces.
3. **Papers:** TARS drafts curator summaries from FOW-Value evidence library (207 sources). Ted selects 10-15 most relevant, edits summaries, adds "why it matters" and "caveats."
4. **Topics:** Seeded from Appendix B taxonomy via `scripts/seed-topics.ts`. Editorial framing added to 5-8 key topics.
5. **Newsletter archive:** Compass back issues migrate as a Phase 2 library addition — valuable for depth but not the launch hook.

### 9.4 Content growth after launch

| Source | Timeline | Content Type |
|---|---|---|
| Beacon agent | Phase 3 | Automated daily paper curation with summaries |
| Members | Ongoing | Discussions, reactions, user-contributed papers |
| Ted | Ongoing | Articles, new tool methodology write-ups |
| Mighty migration | Phase 2+ | Historical content backfill (library depth) |
| Compass archive | Phase 2 | 17 newsletter issues as library addition |

### 9.5 Mighty Networks ongoing role

Post-Hub-launch, Mighty Networks remains the free top-of-funnel. No migration of free-tier members in Phase 1. When the Hub proves its value with 20+ engaged members, evaluate whether to:
- Bridge Mighty → Hub with upgrade CTAs (lightweight)
- Migrate active Mighty members to Hub free tier (medium lift)
- Sunset Mighty entirely (heavy lift, Phase 4+ at earliest)

---

## 10. Agent Integration Architecture (designed Day 1, built Phase 3)

### 10.1 Why design now, build later

Phase 1 ships without agents but with **the data model and API contracts already in place** to support agents in Phase 3. The Member collection's `type='agent'` field and `agentMetadata` group exist from Day 1. No refactoring needed when Beacon arrives.

### 10.2 Agent-as-Member pattern

Each agent is a Member with `type='agent'`. They have:
- An email address (`beacon@agents.wfmlabs.com`)
- A username (`beacon`)
- A profile (`bio`, `tagline`, `role`)
- An avatar
- An API key (stored as Cloudflare Worker Secret)
- A profile page at `/@beacon`
- Posts attributed to them

When Beacon writes a Paper via the API, `Papers.addedBy = beacon.id`. Author attribution preserved automatically. The thing Mighty Networks couldn't do.

### 10.3 Agent runtime: Cloudflare Workers

Each agent is its own Cloudflare Worker. Designed for Phase 3, not built until then.

### 10.4 Communication contracts

**Hub → Agent (webhooks):** Payload's `afterChange` hooks call agent webhook endpoints when relevant events occur.

**Agent → Hub (REST API):** Agents call Payload's REST API with their API key.

**Agent → Agent (A2A protocol):** Each agent exposes an A2A endpoint. Cross-agent collaboration uses the A2A standard. Meaningful only when 2+ agents exist.

**Member-owned agents → Hub (MCP):** The Hub exposes its content as MCP servers. Members configure their own Claude/Cursor agents to read WFM Labs content directly. Phase 4+.

### 10.5 Cost guardrails

Each agent worker enforces:
- Daily cost cap (default $5/day, configurable per agent)
- Per-call max input/output tokens
- Circuit breaker that disables agent when cap hit
- Daily summary email to Ted with spend report

---

## 11. Open MCT / Roc.Cloud Integration (designed Day 1, built Phase 4)

### 11.1 Strategic role

Roc.Cloud is the operations center: real-time WFM telemetry, anomaly detection, the volatility index (O-VIX), community-validated live incidents. It runs on Open MCT (NASA Ames's open-source mission control framework) at `roc.wfmlabs.com`.

### 11.2 Integration patterns

1. **Embedded Open MCT views inside Hub pages.** Scenarios embed live or historical Open MCT views.
2. **Roc-driven Hub objects.** Roc detects anomaly → creates Scenario in Hub via Payload API.
3. **Member-pinned Roc dashboards.** Members configure Open MCT layouts surfaced on their Hub dashboard.
4. **Cross-system identity.** SSO between Hub and Roc via Cloudflare Access.

### 11.3 Relationship to Payload

Roc shares the Payload identity system (Members collection) but has its own Postgres schema for operational data (`tickets`, `ticket_comments`, `ticket_validations`, `ovix_adjustments`). When Roc creates a Scenario, it POSTs to Payload's API. When a member discusses a Roc-created Scenario, that discussion lives in Payload's Discussions collection.

The boundary: **Payload owns content and identity. Roc owns operational telemetry.** They communicate via API, not shared tables.

---

## 12. Email and Notifications

### 12.1 Phase 1 email (minimal)

| Category | Trigger | Template |
|---|---|---|
| Welcome | Signup | `WelcomeEmail` |
| Email verification | Signup | `EmailVerification` |
| Password reset | User request | `PasswordReset` |
| Discussion reply | New reply on object you authored | `DiscussionReply` |

That's it for Phase 1. No weekly digest, no campaign emails, no trial notifications (no trials yet).

### 12.2 Email infrastructure

- **Resend** as transactional email provider
- **React Email** for templates (TypeScript, type-safe)
- Templates in `src/emails/`
- DKIM/SPF/DMARC set up for `wfmlabs.com` domain
- Unsubscribe links with signed tokens

### 12.3 In-app notifications

- `Notifications` collection holds pending notifications per member
- Bell icon in nav shows unread count
- Notification dropdown shows recent items
- Polling every 60s for updates (upgrade to SSE if needed)
- Email delivery parallel to in-app; member can disable per category in preferences

### 12.4 Phase 2 additions

- Weekly digest email
- Trial ending notification
- Payment failed notification
- Subscription canceled notification
- Upgrade invitation campaigns
- Newsletter delivery via Resend Broadcast API

---

## 13. Operational Excellence

### 13.1 Change management

**Conventional commits.** All commits follow `type(scope): description` format. Enforced by commitlint pre-commit hook.

**Architecture Decision Records (ADRs).** Every significant decision gets an ADR in `MEMORY/decisions/NNNN-decision-name.md`:

```markdown
# ADR NNNN: [Title]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-MMMM
**Authors:** [names]

## Context
[What problem are we solving?]

## Decision
[What did we decide?]

## Alternatives considered
[What else did we look at, and why did we reject it?]

## Consequences
[What does this make easier? Harder? What new risks?]
```

**Pull request template** requires: what changed, why, how to test, screenshots if UI.

### 13.2 Quality assurance

**Testing pyramid:**
- **Unit tests (Vitest):** access control functions, hooks, utilities. ~70% of tests.
- **Integration tests (Vitest + Neon dev branch):** collection CRUD, API routes. ~20% of tests.
- **E2E tests (Playwright):** signup, login, browse, view detail, post comment. ~10% of tests.

**Coverage targets:** 80% on access control functions. 70% overall.

**CI on every PR:**
- TypeScript typecheck
- ESLint + Prettier check
- Unit + integration tests
- Build succeeds

**Pre-commit hooks (Husky + lint-staged):**
- Format with Prettier
- Lint with ESLint

### 13.3 Observability (Phase 1 minimal)

**Netlify built-in:** deployment logs, function logs, basic analytics. Sufficient for 20-member beta.

**Phase 2 adds:** Sentry (error tracking), Axiom (structured logging), Better Uptime (synthetic monitoring), Plausible (privacy-respecting analytics).

### 13.4 Backups

**Database (Neon):**
- Free tier: 7 days point-in-time recovery
- Nightly logical dump to R2 via GitHub Actions cron (Phase 2)

**Object storage (R2):**
- Versioning enabled on bucket

**Source code (GitHub):**
- Primary repo `wfmlabsorg/wfmlabs-hub`

### 13.5 Performance targets

- Lighthouse Performance score > 90
- LCP < 2.5s on 4G
- TTFB < 600ms
- Database query P95 < 100ms

### 13.6 Security

- HTTPS everywhere (Netlify automatic + Cloudflare)
- HSTS enabled
- CSP headers in `next.config.ts`
- All input validated with Zod
- Payload uses parameterized queries (no SQL injection)
- Rate limiting on auth endpoints (Cloudflare)
- Secrets via sops + age (never hardcoded)
- Privacy policy and Terms of Service from Day 1

---

## 14. TARS Session Infrastructure

### 14.1 Why this matters

This project spans months and dozens of TARS sessions. Each session starts with no memory of prior sessions. The session infrastructure ensures TARS can come up to speed quickly and leave useful context for the next session.

### 14.2 CLAUDE.md (session bootstrap)

The `CLAUDE.md` at repo root is read automatically by every TARS session. It contains:
- Quick-reference architecture summary (not the full seed doc)
- Current phase and what's been completed
- Link to `MEMORY/current-state.md`
- Link to seed doc for source-of-truth decisions
- Build conventions (commit format, branch strategy, test expectations)
- Known gotchas and learnings

Updated after every meaningful session. Must stay under 200 lines.

### 14.3 MEMORY structure

```
MEMORY/
├── README.md                     How TARS uses this directory
├── current-state.md              What exists, what works, what's next
├── open-questions.md             Unresolved decisions
├── decisions/                    ADRs (numbered, immutable once accepted)
│   ├── 0001-payload-ecosystem-backbone.md
│   ├── 0002-vercel-hosting.md
│   ├── 0003-two-platform-strategy.md
│   ├── 0004-flat-repo-no-monorepo.md
│   ├── 0005-object-anchored-architecture.md
│   ├── 0006-cloudflare-r2-storage.md
│   ├── 0007-resend-email.md
│   ├── 0008-neon-postgres.md
│   ├── 0009-postgres-fts-over-meilisearch.md
│   ├── 0010-commerce-deferred-to-phase-2.md
│   ├── 0011-flat-discussions.md
│   ├── 0012-agents-as-members.md
│   ├── 0013-typescript-bun-next15-react19.md
│   ├── 0014-tailwind-v4.md
│   └── 0015-content-curate-fresh.md
├── learnings/                    Discoveries during build
│   └── YYYY-MM-DD-topic.md
└── sessions/                     Per-session work logs
    └── YYYY-MM-DD-HHMM-topic.md
```

**Removed from v1.0:** `runbooks/` (premature — write when system exists), `revisions/` (git history handles this), separate `context/known-issues.md` and `context/tech-debt.md` (merged into `current-state.md`).

### 14.4 Session protocol

**Every session start:**
1. Read `CLAUDE.md` (auto-loaded)
2. Read `MEMORY/current-state.md`
3. Read 3 most recent session notes in `MEMORY/sessions/`
4. If making architectural decisions, read relevant ADRs

**Every session end (if meaningful work was done):**
1. Write session note to `MEMORY/sessions/YYYY-MM-DD-HHMM-topic.md`
2. Update `MEMORY/current-state.md` if system state changed
3. Write ADR if a significant decision was made
4. Update `CLAUDE.md` if phase status or conventions changed

### 14.5 Session note template

```markdown
# Session: [Topic]

Date: YYYY-MM-DD HH:MM
Phase: [1|2|3|4]

## Goal
[What we set out to do]

## What we did
[Bulleted list of actions, files changed, decisions made]

## What we learned
[New information that changes how we think about the project]

## What's next
[Open items, follow-ups, blockers]

## Files changed
[List with one-line description each]
```

### 14.6 The WFMLabsHub skill

A skill at `~/.claude/skills/WFMLabsHub/SKILL.md` triggers the session protocol:

```yaml
triggers: ["wfmlabs hub", "community.wfmlabs.com", "the hub", "payload hub", "wfm hub"]
```

The skill:
1. Points TARS to the repo at `~/cloud/projects/wfmlabs-hub/`
2. Instructs TARS to read `MEMORY/current-state.md` first
3. References this seed doc as source of truth
4. Requires session notes after meaningful work
5. Requires ADRs for any deviation from the seed doc

### 14.7 ADR numbering

Initial ADRs documenting v1.1 key decisions:

| ADR | Title |
|---|---|
| 0001 | Payload CMS as ecosystem-wide content backbone |
| 0002 | Netlify for application hosting (supersedes Vercel) |
| 0003 | Two-platform strategy (Mighty free, Hub paid) |
| 0004 | Flat repo structure, no monorepo for Phase 1 |
| 0005 | Object-anchored architecture (no feed) |
| 0006 | Cloudflare R2 for object storage |
| 0007 | Resend for transactional email |
| 0008 | Neon Postgres with branching for previews |
| 0009 | Postgres FTS over Meilisearch for Phase 1 |
| 0010 | Commerce (Stripe, tiers) deferred to Phase 2 |
| 0011 | Flat discussions with @-mentions |
| 0012 | Agents as Members with type field |
| 0013 | TypeScript + Bun + Next.js 15 + React 19 |
| 0014 | Tailwind v4 |
| 0015 | Content: curate fresh over Mighty migration |

---

## 15. Phased Build Plan

### 15.1 Phase 1: Platform Foundation (weeks 1–6)

**Goal:** Payload CMS running as headless content API + Next.js frontend. Authenticated members browse curated content and engage in discussions. No payments, no agents, no tier gating.

#### Week 1: Repo, infrastructure, TARS memory

1. Initialize repo with flat structure per Section 6.1
2. Push to `wfmlabsorg/wfmlabs-hub` on GitHub
3. Create `MEMORY/` directory and seed with:
   - README explaining usage
   - ADRs 0001–0015 (one file each)
   - Initial `current-state.md`
   - `open-questions.md`
4. Create `CLAUDE.md` session bootstrap
5. Create `~/.claude/skills/WFMLabsHub/SKILL.md`
6. Set up GitHub Actions CI workflow (lint, typecheck, test)
7. Create Netlify site, link to GitHub, verify preview deployments
8. Create Neon project `wfmlabs-hub`, get connection string
9. Create Cloudflare R2 bucket `wfmlabshub-media`
10. Configure environment variables in Netlify and `.env.local`

**End state:** Empty Next.js app deploys to a preview URL on every PR. TARS memory active.

#### Week 2: Payload backbone + identity

11. Install Payload 3.x with Postgres adapter, R2 storage, Lexical rich text
12. Configure `payload.config.ts`
13. Create collections: `Members`, `Topics`, `Media`
14. Wire Payload auth (email + password)
15. Build admin user creation script
16. Seed Topics from Appendix B
17. Verify admin UI at `/admin` works
18. Verify REST API at `/api/members` works
19. Generate types via `payload generate:types`
20. Add ESLint, Prettier, Vitest, Playwright configs + Husky pre-commit hooks

**End state:** Payload admin accessible, can create members, Topics seeded, types generate.

#### Week 3: Content collections

21. Create `Papers`, `Articles`, `Tools`, `NewsletterIssues` collections
22. Implement access control functions in `src/access/`
23. Create Postgres full-text search indexes via migration
24. Load 17 Compass newsletter issues
25. Load 10–15 curated papers
26. Create 5 tool metadata records (pointing to Netlify deployments)
27. Write unit tests for access control functions

**End state:** Real WFM Labs content accessible via API, browseable in admin.

#### Week 4: Frontend

28. Set up Tailwind v4 + shadcn/ui
29. Build five page templates (`DetailPageLayout`, `BrowsePageLayout`, `ProfilePageLayout`, `OrgPageLayout`, card components)
30. Implement homepage at `/`
31. Implement `/research` browse + `/research/[slug]` detail
32. Implement `/tools` browse + `/tools/[slug]` detail
33. Implement `/compass` browse + `/compass/[issue]` detail
34. Implement `/members` directory + `/@username` profile
35. Implement global navigation + search bar (Postgres FTS)
36. Implement light/dark theme
37. Implement `/login` and `/signup` pages

**End state:** Site visually complete, browsable, WFM Labs brand. Members can sign up and browse.

#### Week 5: Engagement layer

38. Create `Discussions`, `Reactions`, `Notifications` collections
39. Build discussion components (`DiscussionList`, `DiscussionEntry`, `DiscussionForm`)
40. Wire discussion display on detail pages (below content)
41. Implement @-mention parsing and notification creation
42. Implement reaction buttons (like, bookmark)
43. Implement notification bell + dropdown
44. Wire Resend for email templates (welcome, verification, password reset, discussion reply)
45. Build member dashboard at `/me` (saved items, activity, settings)

**End state:** Members can discuss objects, react, get notified. Email flows work.

#### Week 6: Polish + beta launch

46. Create `AuditLog` collection, wire hooks
47. Run Lighthouse audits, fix performance regressions
48. Run Playwright E2E tests on critical flows (signup, login, browse, comment, react)
49. Ted writes 3–5 launch articles
50. Invite 20 beta members manually via `scripts/invite-member.ts`
51. Monitor onboarding, fix issues
52. Write session note documenting Phase 1 completion
53. Update `MEMORY/current-state.md` to reflect launched state

**End state:** 20 members on the platform, engaging with content, 0 critical bugs.

### 15.2 Phase 2: Commerce + Content Expansion (weeks 7–10)

**Goal:** Stripe integration, tier-based access, additional content types.

**Deliverables:**
- Install `@payloadcms/plugin-stripe`
- Create `Plans` and `Subscriptions` collections
- Add `tier` field to Members, `tier` field to content collections
- Implement `tierGate` access control
- Build `/pricing` page
- Implement Stripe Checkout + webhook handler
- Implement Customer Portal integration
- Create `Jobs` and `Scenarios` collections
- Build content migration script for Mighty Networks (with proven target)
- Weekly digest email
- Trial notification emails
- Set up Sentry, analytics

**Decision needed at Phase 2 start:** Tier names, prices, trial strategy (card required — already decided), Founding Member specifics.

### 15.3 Phase 3: Beacon Agent (weeks 10–14)

**Goal:** First agent operating in the Hub.

**Deliverables:**
- Beacon Member account created with API key
- Beacon Cloudflare Worker (discovery, composition, reply)
- Daily research summaries posted by Beacon
- Beacon responds to comments on its papers
- `AgentRuns` collection for cost telemetry
- Agent profile page at `/@beacon`
- Extract `packages/agent-sdk/` from main app (first real consumer)

### 15.4 Phase 4: ROC, Multi-Agent, Ecosystem Integration (weeks 14+)

**Goal:** Open MCT, additional agents, wfmlabs.com bridge, wiki cross-references.

**Deliverables:**
- Open MCT instance at `roc.wfmlabs.com`
- Hub Scenarios can embed Open MCT views
- Caso, Job-Finder agents
- wfmlabs.com tool catalog pulls metadata from Payload API
- Wiki cross-references Payload content
- Extract `packages/shared/` and add Turborepo (multiple consumers now exist)

### 15.5 VERIFY checklist (Phase 1)

Before declaring Phase 1 complete:

- [ ] Members, Topics, Media, Papers, Articles, Tools, NewsletterIssues, Discussions, Reactions, Notifications, AuditLog collections exist and are functional
- [ ] Five page templates render correctly across object types
- [ ] Authentication works (signup, login, password reset)
- [ ] Postgres FTS returns relevant results
- [ ] 17 newsletter issues, 10–15 papers, 5 tools, 3–5 articles loaded
- [ ] Discussion + reactions work on all content types
- [ ] Notification bell shows unread count
- [ ] Email delivery works for all Phase 1 categories
- [ ] 20 beta members successfully onboarded
- [ ] Lighthouse Performance > 90 on all public pages
- [ ] Test coverage > 70% on access control
- [ ] All ADRs (0001–0015) written
- [ ] `MEMORY/current-state.md` reflects accurate post-launch state

---

## 16. Success Metrics

### 16.1 Phase 1 success criteria

| Metric | Target |
|---|---|
| Content loaded | 17 newsletters, 10+ papers, 5 tools, 3+ articles |
| Beta members signed up | 20 |
| Members who posted at least one discussion | 10 |
| Lighthouse Performance > 90 | 100% of public pages |
| Test coverage (access control) | > 80% |
| Critical bugs at launch | 0 |
| Time to first contentful paint (P50) | < 1.5s |

### 16.2 Phase 2 success criteria

| Metric | Target |
|---|---|
| Paid members | 10+ |
| Monthly recurring revenue | $190+ |
| Stripe webhook error rate | < 0.1% |

### 16.3 Long-term success metrics (12 months)

| Metric | Target |
|---|---|
| Paid members | 100+ |
| Monthly recurring revenue | $2,500+ |
| Daily active member rate (paid) | > 60% |
| Content library size | 500+ papers, 50+ tools, 100+ scenarios |

---

## 17. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Payload 3.x production issues | Medium | High | Pin versions; Strapi as documented escape hatch |
| Netlify Next.js adapter issues | Low | Medium | Vercel as documented escape hatch |
| Conversion rate too low (Phase 2) | Medium | High | Beta with 20 members validates value before pricing |
| Solo developer hit by bus | Low | Catastrophic | Documentation, ADRs, session notes make handoff possible |
| Content quality disappoints members | Medium | Medium | Curate high-quality initial library; Beacon validates in Phase 3 |
| Platform feels empty with 40 items | Medium | Medium | Quality > quantity; discussions add life; Beacon adds volume in Phase 3 |
| Postgres FTS quality insufficient | Low | Low | Meilisearch upgrade path documented; API contract stays same |
| Phase 1 scope creep | High | Medium | Strict deferral list; ADR required for any addition |

---

## 18. Open Questions

Tracked in `MEMORY/open-questions.md`. Resolved questions move to ADRs.

### Resolved in v1.1

| # | Question | Resolution |
|---|---|---|
| 1 | Discussion threading: flat or nested? | Flat with @-mentions. Schema supports future one-level nesting. ADR-0011. |
| 2 | Founding Member: separate tier or flag? | Flag (`foundingMember: true`) on Practitioner Plus members. Not a separate tier. |
| 3 | Meilisearch or Postgres FTS? | Postgres FTS for Phase 1. Meilisearch when content > 500 items. ADR-0009. |
| 4 | Monorepo or flat? | Flat for Phase 1. Extract packages when second consumer exists. ADR-0004. |

### Deferred to Phase 2

| # | Question | Notes |
|---|---|---|
| 5 | Tier names and prices? | Practitioner / Practitioner Plus are working names. Final names and prices decided when commerce layer ships. |
| 6 | Free trial: card required? | Card required (decided). Implementation in Phase 2. |
| 7 | Builder Lab ($49/mo) vs Hub Practitioner Plus ($49/mo)? | These should be the same product. Decide when commerce layer ships. |
| 8 | Annual billing default? | Decide when pricing page ships. |
| 9 | Public visibility of paper abstracts (SEO)? | Decide when tier gating ships. Recommend titles + abstracts public. |
| 10 | Member directory privacy default? | Decide when tier gating ships. Recommend opt-out (listed by default). |

### Open

| # | Question | Notes |
|---|---|---|
| 11 | Desktop-first or mobile-first? | Recommend desktop-first (knowledge workers at desks); mobile-responsive but not native. |
| 12 | wfmlabs.com: when does Hugo pull from Payload? | Phase 4+. Design the API now; bridge when ready. |
| 13 | ROC Postgres schema: shared tables or API boundary? | API boundary (Payload owns content/identity, ROC owns telemetry). Designed in Section 11.3. |

---

## Appendix A: ADR Template

```markdown
# ADR NNNN: [Title]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-MMMM
**Authors:** [names]

## Context

[What is the situation that requires a decision? What forces are at play?]

## Decision

[What did we decide to do?]

## Alternatives considered

### Option A: [name]
[Description, pros, cons, why rejected]

### Option B: [name]
[Description, pros, cons, why rejected]

## Consequences

### Positive
- [What this makes easier or better]

### Negative
- [What this makes harder, what we give up]

## References

- [Link to seed document section]
- [Link to related ADRs]
```

---

## Appendix B: Initial Topics Taxonomy

Seed `Topics` collection with this hierarchy on Day 1. Each topic gets a slug, name, description, optional parent.

```yaml
- forecasting:
    - intraday-forecasting
    - long-range-forecasting
    - generative-ai-forecasting
    - demand-modeling
- scheduling:
    - shift-bidding
    - scheduling-fairness
    - real-time-adjustments
    - schedule-optimization
- staffing:
    - capacity-planning
    - headcount-planning
    - attrition-modeling
    - hybrid-workforce
- agent-experience:
    - burnout
    - engagement
    - training
    - ai-augmentation
- queueing-theory:
    - service-levels
    - abandonment
    - multi-skill-routing
    - virtual-queues
    - erlang
- ai-in-operations:
    - agent-assist
    - conversational-ai
    - voice-bots
    - sentiment-analysis
- workforce-economics:
    - labor-markets
    - automation-substitution
    - value-model
    - gig-work
- service-quality:
    - csat
    - nps
    - first-call-resolution
    - quality-management
- regulatory:
    - ai-governance
    - labor-law
    - compliance
    - privacy
- adjacent-fields:
    - behavioral-economics
    - organizational-design
    - human-computer-interaction
    - operations-research
```

---

## Appendix C: Environment Variables

`.env.example` for Phase 1:

```
# Payload
PAYLOAD_SECRET=<random-32-char>
NEXT_PUBLIC_SERVER_URL=https://community.wfmlabs.com

# Database
DATABASE_URI=postgres://...@neon.tech/wfmlabshub

# Storage
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=wfmlabshub-media
R2_ENDPOINT=
R2_PUBLIC_URL=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@community.wfmlabs.com

# Phase 2 additions (not needed for Phase 1):
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# MEILISEARCH_HOST=
# MEILISEARCH_API_KEY=
# SENTRY_DSN=
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
```

---

## Appendix D: CLAUDE.md Template

This template is used for the repo's `CLAUDE.md` file, updated after each session:

```markdown
# WFM Labs Hub — TARS Session Bootstrap

## Quick Reference
- **Seed doc:** `wfmlabs-platform-seed-v1.1.md` (source of truth)
- **Current state:** `MEMORY/current-state.md`
- **Phase:** 1 (Foundation)
- **Status:** [CURRENT STATUS]

## Architecture
- Payload CMS 3.x + Next.js on Netlify
- Neon Postgres (serverless)
- Cloudflare R2 (media)
- Resend (email)
- Flat repo, no monorepo

## Session Protocol
1. Read this file + MEMORY/current-state.md
2. Read 3 most recent session notes
3. Do the work
4. Write session note to MEMORY/sessions/
5. Update current-state.md if state changed
6. Write ADR if significant decision made

## Build Conventions
- Bun for packages (NEVER npm/yarn)
- Conventional commits: type(scope): description
- Tests required for access control functions
- Pre-commit: prettier + eslint

## What Exists
[Updated after each session]

## Known Issues
[Updated after each session]
```

---

# Document Maintenance

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0 | 2026-05-09 | Ted Lango + Claude | Initial seed |
| 1.1 | 2026-05-09 | Ted Lango + TARS | Architecture revision: ecosystem-wide Payload, flat repo, deferred commerce, Postgres FTS, flat discussions, reduced services, revised phasing, simplified MEMORY |

Revision protocol:
1. Edit this file
2. Bump version at top
3. Add row to maintenance log above
4. Write ADR explaining what changed and why
5. Commit with message `docs(seed): bump to vX.Y — [summary]`

End of Seed Document v1.1.
