# WFM Labs Community Platform — Seed Document v1.0

**Project codename:** WFM Labs Hub (informal: "the Hub")
**Repository:** `wfmlabsorg/wfmlabs-hub` (proposed)
**Production URL:** `community.wfmlabs.com`
**Status:** Pre-launch, Phase 1 scaffolding
**Author:** Ted Lango
**Document version:** 1.0 — initial seed
**Last revised:** 2026-05-09
**Document owner:** Ted Lango
**Maintained by:** TARS, with revision logs in `~/cloud/projects/wfmlabs-hub/MEMORY/`

---

## 0. How to read this document

This is the foundational seed document for the WFM Labs paid community platform. It defines the vision, the architecture, the data model, the operational standards, and the integration points for future agents and Open MCT / Roc.Cloud.

It is the **source of truth** for design decisions. When TARS or Ted disagrees with a choice made here, the document gets revised — not the implementation. Revisions are tracked in `MEMORY/decisions/` as Architecture Decision Records (ADRs).

This document will be revised. Expect v1.1, v1.2, v2.0 as the system evolves. Every revision must:
1. Update this file with the new content
2. Bump the version number at the top
3. Write an ADR explaining what changed and why
4. Commit both with a clear message

The document is structured so that:
- Sections 1–4 establish vision and strategy
- Sections 5–10 specify the technical architecture
- Sections 11–15 cover operational excellence
- Section 16 specifies how TARS maintains memory across sessions
- Section 17 is the Phase 1 launch prompt

---

## 1. Executive Summary

WFM Labs Hub is the paid extension of the WFM Labs community, built as an agent-native, object-anchored practitioner workspace at `community.wfmlabs.com`. It complements the existing free community on Mighty Networks (`community.wfmlabs.org`) without replacing it.

Where Mighty Networks is feed-based and chat-shaped, the Hub is a structured workspace where workforce management practitioners engage with first-class content objects (research papers, jobs, calculators, tools, scenarios, articles), AI agents that produce daily artifacts, and a live operations center (Roc.Cloud, integrated via Open MCT). Members log in not because they want to scroll a feed but because Beacon published a research summary overnight, Caso responded to a scenario they posted, the volatility index moved, or a calculator they bookmarked just got an update.

The Hub is built on Payload CMS + Next.js, deployed on Vercel, with Neon Postgres for data, Cloudflare R2 for files, Resend for email, Cloudflare Workers for agent runtimes, and Stripe for subscriptions. It targets $50–80/month of operating infrastructure and $80–200/month all-in including Anthropic API costs for one to two active agents.

Phase 1 (this seed document's scope) ships the platform foundation with content migration from Mighty Networks, two paid tiers, member onboarding, Stripe subscriptions, and the design system — without agents or Open MCT. Phase 2 adds Beacon (research librarian agent). Phase 3 adds Open MCT integration for Roc.Cloud. Phase 4 adds additional agents and deeper integrations.

The strategic reframe is critical: this is not a Mighty Networks replacement. It is a structurally different category of product that justifies its own pricing and survives comparison shopping. Mighty Networks is the funnel; the Hub is the business.

---

## 2. Vision and Strategic Context

### 2.1 The thesis

Workforce management is shifting from purely human teams to hybrid human-and-agentic teams. WFM practitioners need a place to learn, practice, and engage with this shift — not as theory but as lived experience. WFM Labs Hub is the first practitioner community where members work alongside named AI agents on real problems, building intuition about hybrid collaboration that they can take back to their organizations.

The Hub is itself a demonstration of the value model thesis: knowledge workers and agents producing better intelligence together than either could alone, with the artifacts (research summaries, scenario analyses, forecasts, recommendations) accumulating over time as the community's shared knowledge base.

### 2.2 The two-platform strategy

| Property | community.wfmlabs.org (Mighty) | community.wfmlabs.com (Hub) |
|---|---|---|
| **Tier** | Free | Paid (Practitioner $19/mo, Practitioner Plus $49/mo) |
| **Shape** | Feed-based, chat-shaped | Object-anchored, workspace-shaped |
| **Engagement** | Posts, comments, events | Curated artifacts, threaded discussion on objects, live agents |
| **Content** | Posts that scroll away in 48 hours | Permanent URLs, accumulating library |
| **Agents** | None (Mighty doesn't support author attribution) | First-class members (Beacon, Caso, Job-Finder, etc.) |
| **Operations** | Static | Live (Roc.Cloud, value model in motion) |
| **Cost to Ted** | Existing Legacy plan ($99/mo) | $80–200/mo all-in |
| **Role** | Top-of-funnel discovery, marketing | Revenue, accumulating moat, demonstration |

The free tier on Mighty stays as it is. Members upgrade to the Hub when they want the full library, the live agents, the operations center, and the deeper community of paying practitioners. Mighty becomes the funnel; the Hub is the business.

### 2.3 Strategic value beyond revenue

The Hub is not just a community product. It is:

- **A portfolio piece for Ted's value model thesis.** When Ted talks to Intradiem leadership, pitches investors, or writes the next book, "I run a working hybrid human-agent practitioner community generating $X MRR" is a credential nobody else in WFM has.
- **A reference implementation that other industries will study.** The same architecture lights up for procurement teams, supply chain planners, FP&A practitioners, capacity planners. Once it works for WFM, the model is portable.
- **A research and content engine.** Beacon's work fuels the Compass newsletter, supports Ted's role at Intradiem, and produces material for the next book.
- **An asset that compounds.** Every paper Beacon curates, every scenario members post, every discussion thread becomes a permanent searchable artifact. Mighty's content evaporates; the Hub's content accrues.

### 2.4 What the Hub is not

Clarity matters here:

- It is **not a replacement for Mighty Networks.** Mighty stays as the free tier.
- It is **not a forum.** Threaded discussion exists but is anchored to specific objects, not to free-floating topics.
- It is **not a feed.** There is no infinite scroll homepage. The homepage is structured browse.
- It is **not chat.** There is no real-time chat interface. Asynchronous threaded discussion only.
- It is **not a learning management system.** It hosts content but does not run courses. Cohort programs may run on top of it but the LMS shape is wrong.
- It is **not a Slack alternative.** Different shape, different audience.
- It is **not a course platform.** Skool and Disco are the wrong category.
- It is **not Hugging Face for WFM** in a literal sense, but it borrows the *information architecture pattern* from Hugging Face: object-anchored, card-based, contribution-driven, profile-aggregated.

### 2.5 The ecosystem the Hub fits into

WFM Labs is an evolving ecosystem of related properties:

```
WFM Labs Ecosystem
├── wfmlabs.org                    Brand homepage (Hugo, exists)
├── community.wfmlabs.org          Free community (Mighty Networks, exists)
├── community.wfmlabs.com          Paid Hub (THIS PROJECT, new)
├── compass.wfmlabs.com            Compass newsletter (potential subdomain, future)
├── valuemodel.wfmlabs.com         Interactive value-based planning model (exists)
├── roc.wfmlabs.com                Roc.Cloud / Open MCT (future, separate)
└── tools.wfmlabs.com              Public calculators (potential, future)
```

The Hub at `community.wfmlabs.com` is the central member-facing application. It links out to other properties (valuemodel, compass, roc) as embedded experiences or external links depending on technical fit. Roc.Cloud will eventually be a separate Open MCT instance that the Hub embeds and discusses around.

The Hub does not consume content from other WFM Labs properties; rather, content flows from the Hub outward (Beacon's research summaries become Compass newsletter draft material; Hub discussions feed back into Compass; live ops in Roc generate Hub discussion threads).

---

## 3. Domain and Brand Strategy

### 3.1 Domain assignments

| Domain | Property | Rationale |
|---|---|---|
| `wfmlabs.org` | Brand homepage (existing) | Public-facing, SEO-optimized brand site |
| `community.wfmlabs.org` | Mighty Networks (free tier) | Existing; member relationship lives here |
| `community.wfmlabs.com` | The Hub (paid tier, new) | Paid tier; clean separation of free vs. paid |
| `wfmlabs.com` | Redirect to `wfmlabs.org` | Keep simple, avoid brand fragmentation |
| `*.wfmlabs.com` | Future paid properties | All paid offerings on .com |
| `*.wfmlabs.org` | Free properties + brand | All free / public properties on .org |

The mental model: **`.org` is what's free; `.com` is what's paid.** This is unusual (usually it's the inverse) but the convention works here because the .org domain has the deeper brand history and the .com is being repurposed for revenue properties. Members understand the split intuitively after one explanation.

### 3.2 Why community.wfmlabs.com specifically

- Parallel construction to `community.wfmlabs.org` makes the upgrade story clear: "your paid version of the community"
- Memorable, brandable, easy to type
- Supports SEO independent of the .org domain
- Allows independent SSL, DNS, and CDN management
- Future-proof for the eventual case where the free tier moves off Mighty

### 3.3 Branding consistency

The Hub uses the WFM Labs brand identity: same color palette, same typography, same logo, same voice. Members should feel they're in a more polished, more capable version of the same community — not a different product.

Distinctive UI elements that signal "this is the paid Hub":
- Object-anchored layout (no infinite feed)
- Agent presence indicators (Beacon's avatar in the navbar, etc.)
- "Practitioner" or "Practitioner Plus" badge on member profiles
- More information density than Mighty's chat-shaped UI

---

## 4. Information Architecture

### 4.1 Sitemap

```
community.wfmlabs.com
├── /                                 Homepage (org page pattern)
├── /research/                        Research library browse
│   ├── /research/[paper-slug]        Paper detail page
│   └── /research/topics/[topic]      Topic-filtered browse
├── /jobs/                            Job hub browse
│   ├── /jobs/[job-slug]              Job detail page
│   └── /jobs/post                    Post a job (paid feature)
├── /tools/                           Tools and calculators browse
│   ├── /tools/[tool-slug]            Tool detail / interactive page
│   └── /tools/categories/[cat]       Category-filtered browse
├── /scenarios/                       Member-posted scenarios
│   └── /scenarios/[scenario-slug]    Scenario detail page
├── /compass/                         Newsletter archive
│   └── /compass/[issue-slug]         Newsletter issue detail
├── /agents/                          Agent roster
│   └── /agents/[agent-slug]          Agent profile / activity log
├── /members/                         Member directory (paid only)
│   └── /@[username]                  Member profile page
├── /me/                              Member dashboard
│   ├── /me/settings                  Profile, password, notifications
│   ├── /me/subscription              Stripe portal integration
│   ├── /me/saved                     Saved papers, jobs, tools
│   └── /me/activity                  Personal activity log
├── /admin                            Payload admin (auth-gated)
├── /api/...                          Payload REST + GraphQL APIs
├── /pricing                          Plan comparison + upgrade
├── /signup                           Registration
├── /login                            Login
└── /about                            About the Hub
```

### 4.2 Page templates (the five Hugging Face-inspired patterns)

Every page in the Hub uses one of five templates. This consistency is what makes the platform feel coherent.

**Pattern 1: Card** — used in lists. Title, key metadata, owner avatar, recent activity indicator, action buttons (save, like, discuss). Renders identically across browse, search results, profile pages, and homepage.

**Pattern 2: Detail page** — used for single objects. Header (title, metadata, owner, dates), main body (full content), sidebar (stats, related items, actions), threaded discussion below. Permanent URL, OpenGraph tags, structured data for SEO.

**Pattern 3: Browse** — used for object-type indexes. Faceted filters in left sidebar (topics, dates, authors, etc.), card grid in main column, search bar at top, sort options. Same shape across `/research`, `/jobs`, `/tools`, `/scenarios`.

**Pattern 4: Profile** — used for members and agents. Header with avatar and bio, tabs for different contribution types (papers, jobs posted, tools, discussions), activity timeline, stats sidebar.

**Pattern 5: Org/community page** — used for the homepage and topic pages. Hero section, featured content, recent activity across object types, agent activity, member highlights, calls to action.

### 4.3 Navigation

Persistent global navigation:
- Logo (links to homepage)
- Primary nav: Research, Jobs, Tools, Scenarios, Compass, Agents
- Search (global, returns objects across all types)
- User menu (profile, dashboard, settings, logout)
- Notification bell (count of unread)

No sidebar navigation by default. Sidebar appears only on browse pages for filters.

### 4.4 Search

Global search returns **objects, not posts.** Searching "scheduling fairness" returns:
- Papers tagged with that topic
- Jobs that mention it in description
- Tools that calculate it
- Scenarios that involve it
- Compass issues that cover it
- Members who have contributed on the topic
- Agents whose work touches it

Faceted filtering refines results by type, date, author, tier. Results are ranked by relevance and recency. Search engine: Meilisearch (self-hosted on Hetzner $5/mo or Meilisearch Cloud at $25/mo entry tier).

---

## 5. Technology Stack

### 5.1 Stack overview

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15+ App Router** | Native Payload integration; React Server Components; full TypeScript; large ecosystem |
| CMS | **Payload CMS 3.x** | TypeScript-native; admin UI included; auto-generated REST + GraphQL APIs; runs as Next.js app; MIT licensed |
| Database | **Neon Postgres (Serverless)** | Already in stack; branching for previews; auto-scaling; point-in-time recovery |
| Object storage | **Cloudflare R2** | Already in stack; cheaper than Vercel Blob; S3-compatible API |
| Hosting | **Vercel** (primary) or **Netlify** (fallback) | Best Payload support; native Next.js; preview environments per PR; generous free tier; Cloudflare Pages doesn't support Payload's Node.js requirements |
| Email | **Resend** | TypeScript-native; React Email templates; Ted already has account; clean Payload integration |
| Auth | **Payload built-in auth** + **Stripe Customer Portal** | Native to platform; tier-aware; minimal complexity |
| Payments | **Stripe Subscriptions** | Industry standard; Customer Portal handles all subscription management; Payload official plugin (`@payloadcms/plugin-stripe`) |
| Search | **Meilisearch** (self-hosted) | TypeScript-native client; faceted search; affordable; open source |
| Analytics | **Plausible** ($9/mo) or **PostHog** (free tier) | Privacy-respecting; minimal config |
| Error tracking | **Sentry** (free tier) | Industry standard; integrates with Vercel deployments |
| Logs | **Axiom** (free tier 500GB) | Modern logging; low ops burden |
| CDN | **Vercel** + **Cloudflare** | Vercel CDN automatic; Cloudflare in front for additional caching, WAF, DDoS protection |
| Source control | **GitHub** (`wfmlabsorg`) | Existing; Actions for CI/CD |
| CI/CD | **Vercel automatic deployments** + **GitHub Actions** for tests | Each PR gets a preview URL; main branch deploys to production |
| Agent runtime (future) | **Cloudflare Workers** | Already in stack; serverless cron and webhook handling; cheap; scales to zero |
| Secrets | **Vercel Environment Variables** + **sops + age** for repo-tracked encrypted secrets | Vercel for runtime; sops for shared dev secrets in repo |
| Monitoring | **Vercel Analytics** + **Better Uptime** for synthetic monitoring | Built-in performance + uptime alerting |

### 5.2 Why Vercel over Netlify and Cloudflare Pages

- **Cloudflare Pages** uses the Workers runtime, which has limited Node.js compatibility. Payload 3.x requires Node.js APIs (filesystem-style operations, certain crypto) that don't work reliably on Workers. Disqualified for the main app, but used heavily for agent runtimes (where the Worker model is correct).
- **Netlify** works for Next.js and supports Node.js via Functions. Payload runs on Netlify but the path is less battle-tested. Use as fallback if Vercel pricing or features become an issue.
- **Vercel** is where Next.js is developed and where Payload 3.x is most heavily tested. Free Hobby tier covers initial usage; $20/month Pro tier when needed. Database branching with Neon integrated. Preview deployments per PR are excellent for code review.

The Hub uses Vercel for the app, Cloudflare for everything around it (R2, Workers, DNS, WAF). Cleanest possible split.

### 5.3 Why Payload over Strapi or Sanity

- **Payload**: TypeScript-native, runs as a Next.js app (single deploy), MIT license, excellent for this exact use case (community + content + custom data models). Schema-as-code in TypeScript means TARS can edit collections fluently. Active development with strong VC backing.
- **Strapi**: Also good but Node.js-coupled rather than Next.js-coupled, separate deployment, more plugin-ecosystem-shaped. Fine choice but less elegant for this use case.
- **Sanity**: SaaS, vendor lock-in concerns, schema in their proprietary format. Disqualified for ownership reasons.

If Payload becomes problematic for any reason, Strapi is the migration path. The collection definitions translate roughly 1:1.

### 5.4 Packages and versions (initial pinning)

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "payload": "^3.0.0",
    "@payloadcms/db-postgres": "^3.0.0",
    "@payloadcms/plugin-stripe": "^3.0.0",
    "@payloadcms/plugin-cloud-storage": "^3.0.0",
    "@payloadcms/storage-r2": "^3.0.0",
    "@payloadcms/richtext-lexical": "^3.0.0",
    "stripe": "^17.0.0",
    "resend": "^4.0.0",
    "react-email": "^3.0.0",
    "@tanstack/react-query": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "shadcn-ui": "latest",
    "meilisearch": "^0.45.0",
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

Pin major versions only at this stage; allow minor and patch updates via standard semver. Lock file (`bun.lockb` or `pnpm-lock.yaml`) commits to repo for reproducible builds. Use Bun for package management per Ted's stack preference.

---

## 6. Repository Structure

### 6.1 Monorepo layout

```
~/cloud/projects/wfmlabs-hub/                  Working directory
├── README.md                                   Project overview, quickstart
├── ARCHITECTURE.md                             Architecture overview (this doc condensed)
├── CHANGELOG.md                                Auto-generated by changesets
├── CONTRIBUTING.md                             How to contribute (for Ted + future contributors)
├── LICENSE                                     MIT or proprietary, TBD
├── .gitignore
├── .env.example                                Environment variable template
├── package.json                                Bun workspace root
├── bun.lockb                                   Lock file
├── tsconfig.base.json                          Shared TS config
├── turbo.json                                  Turborepo config (for monorepo task running)
│
├── apps/
│   ├── web/                                    Next.js + Payload application
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── payload.config.ts                   Main Payload config
│   │   ├── src/
│   │   │   ├── app/                            Next.js App Router
│   │   │   │   ├── (frontend)/                 Public-facing pages
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx               Homepage
│   │   │   │   │   ├── research/
│   │   │   │   │   │   ├── page.tsx           Browse research
│   │   │   │   │   │   └── [slug]/
│   │   │   │   │   │       └── page.tsx       Paper detail
│   │   │   │   │   ├── jobs/
│   │   │   │   │   ├── tools/
│   │   │   │   │   ├── scenarios/
│   │   │   │   │   ├── compass/
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── members/
│   │   │   │   │   ├── me/
│   │   │   │   │   ├── pricing/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── signup/
│   │   │   │   ├── (payload)/                  Payload admin routes
│   │   │   │   │   ├── admin/
│   │   │   │   │   └── api/
│   │   │   │   └── api/                        Custom API routes
│   │   │   │       ├── stripe/
│   │   │   │       │   ├── webhook/
│   │   │   │       │   └── checkout/
│   │   │   │       ├── search/
│   │   │   │       └── agents/                 Agent webhook receivers (Phase 2+)
│   │   │   ├── collections/                    Payload collections
│   │   │   │   ├── Papers.ts
│   │   │   │   ├── Articles.ts
│   │   │   │   ├── Jobs.ts
│   │   │   │   ├── Tools.ts
│   │   │   │   ├── Scenarios.ts
│   │   │   │   ├── NewsletterIssues.ts
│   │   │   │   ├── Members.ts
│   │   │   │   ├── Agents.ts
│   │   │   │   ├── Discussions.ts
│   │   │   │   ├── Reactions.ts
│   │   │   │   ├── Topics.ts
│   │   │   │   ├── Plans.ts
│   │   │   │   ├── Subscriptions.ts
│   │   │   │   ├── Notifications.ts
│   │   │   │   ├── Events.ts
│   │   │   │   ├── Badges.ts
│   │   │   │   ├── AuditLog.ts
│   │   │   │   ├── AgentRuns.ts                Phase 2+
│   │   │   │   └── Media.ts
│   │   │   ├── access/                         Reusable access control functions
│   │   │   │   ├── isAdmin.ts
│   │   │   │   ├── isMember.ts
│   │   │   │   ├── isPaidMember.ts
│   │   │   │   ├── isAuthor.ts
│   │   │   │   └── tierGate.ts
│   │   │   ├── hooks/                          Payload lifecycle hooks
│   │   │   │   ├── auditLog.ts
│   │   │   │   ├── searchIndex.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   └── stripeSync.ts
│   │   │   ├── components/                     React components
│   │   │   │   ├── cards/                      Pattern 1
│   │   │   │   │   ├── PaperCard.tsx
│   │   │   │   │   ├── JobCard.tsx
│   │   │   │   │   ├── ToolCard.tsx
│   │   │   │   │   ├── ScenarioCard.tsx
│   │   │   │   │   ├── MemberCard.tsx
│   │   │   │   │   └── AgentCard.tsx
│   │   │   │   ├── pages/                      Pattern 2 + 3 + 4 + 5
│   │   │   │   │   ├── DetailPageLayout.tsx
│   │   │   │   │   ├── BrowsePageLayout.tsx
│   │   │   │   │   ├── ProfilePageLayout.tsx
│   │   │   │   │   └── OrgPageLayout.tsx
│   │   │   │   ├── discussion/
│   │   │   │   │   ├── ThreadView.tsx
│   │   │   │   │   ├── ReplyForm.tsx
│   │   │   │   │   └── ReactionBar.tsx
│   │   │   │   ├── nav/
│   │   │   │   │   ├── GlobalNav.tsx
│   │   │   │   │   ├── UserMenu.tsx
│   │   │   │   │   └── SearchBar.tsx
│   │   │   │   └── ui/                         shadcn/ui components
│   │   │   ├── lib/                            Utilities
│   │   │   │   ├── stripe.ts
│   │   │   │   ├── resend.ts
│   │   │   │   ├── meilisearch.ts
│   │   │   │   ├── r2.ts
│   │   │   │   └── analytics.ts
│   │   │   ├── emails/                         React Email templates
│   │   │   │   ├── WelcomeEmail.tsx
│   │   │   │   ├── PasswordReset.tsx
│   │   │   │   ├── DiscussionReply.tsx
│   │   │   │   ├── PractitionerWelcome.tsx
│   │   │   │   └── WeeklyDigest.tsx
│   │   │   ├── styles/
│   │   │   │   └── globals.css
│   │   │   └── types/
│   │   │       └── payload-types.d.ts          Auto-generated by Payload
│   │   ├── tests/
│   │   │   ├── unit/                           Vitest
│   │   │   ├── integration/                    Vitest, hits real Neon dev branch
│   │   │   └── e2e/                            Playwright
│   │   └── public/                             Static assets
│   │
│   └── docs/                                   Internal documentation site (future)
│
├── packages/
│   ├── shared/                                 Shared types, constants
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── tiers.ts
│   │   └── tsconfig.json
│   │
│   ├── design-system/                          Shared design tokens, primitive components
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── tokens/
│   │   │   ├── primitives/
│   │   │   └── theme.ts
│   │   └── tsconfig.json
│   │
│   └── agent-sdk/                              Agent integration SDK (Phase 2+)
│       ├── package.json
│       ├── src/
│       │   ├── client.ts                       Wraps Payload API for agent use
│       │   ├── auth.ts
│       │   └── types.ts
│       └── tsconfig.json
│
├── infrastructure/
│   ├── README.md
│   ├── vercel.json                             Vercel project config
│   ├── neon/
│   │   └── README.md                           Neon setup notes
│   ├── cloudflare/
│   │   ├── r2-bucket.md                        R2 bucket setup
│   │   └── workers/                            Future agent workers
│   └── github-actions/                         (also in .github/workflows/)
│
├── scripts/
│   ├── seed.ts                                 Initial database seed
│   ├── migrate-from-mighty.ts                  Mighty content import
│   ├── backup-db.ts                            Manual database backup trigger
│   ├── generate-types.ts                       Regenerate Payload types
│   └── invite-member.ts                        Manual member invite
│
├── MEMORY/                                     TARS memory system (see Section 16)
│   ├── README.md
│   ├── decisions/                              ADRs
│   │   ├── 0001-payload-cms.md
│   │   ├── 0002-vercel-hosting.md
│   │   ├── 0003-two-platform-strategy.md
│   │   └── ...
│   ├── context/                                Current state
│   │   ├── current-state.md
│   │   ├── known-issues.md
│   │   └── tech-debt.md
│   ├── learnings/                              Things learned in build
│   │   └── ...
│   ├── revisions/                              Major revision logs
│   │   └── seed-doc-v1-to-v1.1.md
│   └── runbooks/
│       ├── deploy.md
│       ├── rollback.md
│       ├── restore-db.md
│       └── invite-member.md
│
├── docs/                                       Public-facing project docs
│   ├── architecture.md                         Distilled from this doc
│   ├── data-model.md
│   ├── api.md
│   ├── deployment.md
│   ├── migration-from-mighty.md
│   └── agent-integration.md                    Phase 2+
│
└── .github/
    ├── workflows/
    │   ├── ci.yml                              Lint, typecheck, test on PR
    │   ├── deploy-preview.yml                  Vercel preview per PR
    │   ├── deploy-production.yml               Production deploy on main merge
    │   ├── nightly-backup.yml                  Database snapshot to R2
    │   └── visual-regression.yml               Chromatic on PR
    ├── ISSUE_TEMPLATE/
    │   ├── bug.md
    │   ├── feature.md
    │   └── adr.md
    ├── PULL_REQUEST_TEMPLATE.md
    └── CODEOWNERS
```

### 6.2 Why monorepo

The monorepo structure supports multiple deployable units (web app, future agent workers, future docs site) sharing types, design tokens, and SDK code without duplication. Turborepo handles task running and caching. Bun handles package management.

For Phase 1, only the `apps/web` directory is actively developed. Other directories are scaffolded with placeholder READMEs to establish the structure.

---

## 7. Data Model

This section specifies every collection in Payload. Each collection has access control rules, lifecycle hooks, and field schemas. The implementations live in `apps/web/src/collections/` and follow the Payload TypeScript collection config pattern.

### 7.1 Members

The central identity collection. Both human members and AI agents are stored here, distinguished by `type` field.

```typescript
{
  slug: 'members',
  auth: { useAPIKey: true },     // Enables API key auth for agents
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'username', type: 'text', required: true, unique: true,
      validate: (v) => /^[a-z0-9-]{3,30}$/.test(v) },
    { name: 'displayName', type: 'text', required: true },
    { name: 'type', type: 'select', required: true, defaultValue: 'human',
      options: ['human', 'agent', 'admin'] },
    { name: 'tier', type: 'select', required: true, defaultValue: 'free',
      options: ['free', 'practitioner', 'practitioner-plus', 'founding'] },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea' },
    { name: 'profile', type: 'group', fields: [
      { name: 'title', type: 'text' },                    // e.g., "VP Operations"
      { name: 'company', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'linkedinUrl', type: 'text' },
      { name: 'expertise', type: 'array', fields: [
        { name: 'topic', type: 'relationship', relationTo: 'topics' }
      ]},
      { name: 'tShirtSize', type: 'select',
        options: ['xs','s','m','l','xl','xxl'] }            // For future merch
    ]},
    { name: 'agentMetadata', type: 'group',
      admin: { condition: (data) => data.type === 'agent' },
      fields: [
        { name: 'tagline', type: 'text' },
        { name: 'role', type: 'text' },                     // 'research librarian' etc.
        { name: 'beliefsUrl', type: 'text' },               // R2 URL for BELIEFS.md
        { name: 'mcpEndpoint', type: 'text' },              // For A2A discovery
        { name: 'a2aCardUrl', type: 'text' }
    ]},
    { name: 'preferences', type: 'group', fields: [
      { name: 'emailNotifications', type: 'checkbox', defaultValue: true },
      { name: 'weeklyDigest', type: 'checkbox', defaultValue: true },
      { name: 'theme', type: 'select', options: ['light', 'dark', 'system'] }
    ]},
    { name: 'stripeCustomerId', type: 'text', admin: { readOnly: true } },
    { name: 'foundingMember', type: 'checkbox', defaultValue: false,
      admin: { description: 'First 100 paid members' } },
    { name: 'invitedBy', type: 'relationship', relationTo: 'members' },
    { name: 'lastActiveAt', type: 'date', admin: { readOnly: true } }
  ],
  access: {
    read: ({ req: { user } }) => Boolean(user),                 // Members see other members
    create: ({ req: { user } }) => user?.type === 'admin',
    update: ({ req: { user }, id }) => 
      user?.type === 'admin' || (user?.id === id),
    delete: ({ req: { user } }) => user?.type === 'admin'
  },
  hooks: {
    afterChange: [auditLogHook, searchIndexHook]
  }
}
```

### 7.2 Papers

Research papers curated by Beacon and shared by members.

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
      options: ['arxiv','ssrn','journal','industry-report','blog','vendor-research','manual'] },
    { name: 'publishedDate', type: 'date' },
    { name: 'addedBy', type: 'relationship', relationTo: 'members', required: true },
    { name: 'abstract', type: 'textarea' },
    { name: 'fullText', type: 'textarea',
      access: { read: tierGate('practitioner') } },         // Paid only
    { name: 'curatorSummary', type: 'richText',
      admin: { description: 'Beacon\'s summary or member contribution' } },
    { name: 'whyItMatters', type: 'richText' },
    { name: 'caveats', type: 'richText' },
    { name: 'topics', type: 'relationship', relationTo: 'topics', hasMany: true },
    { name: 'pdfFile', type: 'upload', relationTo: 'media' },
    { name: 'tier', type: 'select', defaultValue: 'practitioner',
      options: ['public','free','practitioner','practitioner-plus'] },
    { name: 'discussionCount', type: 'number', defaultValue: 0,
      admin: { readOnly: true } },
    { name: 'reactionCount', type: 'number', defaultValue: 0,
      admin: { readOnly: true } },
    { name: 'savedByCount', type: 'number', defaultValue: 0,
      admin: { readOnly: true } },
    { name: 'sourceFingerprint', type: 'text', unique: true,
      admin: { description: 'Hash of sourceUrl for dedup', readOnly: true },
      hooks: { beforeValidate: [hashSourceUrl] } }
  ],
  access: {
    read: ({ req: { user }, doc }) => {
      if (!doc) return tierGate('practitioner')({ req: { user } })
      const tierOrder = ['public','free','practitioner','practitioner-plus']
      const userTierIdx = tierOrder.indexOf(user?.tier ?? 'public')
      const docTierIdx = tierOrder.indexOf(doc.tier)
      return userTierIdx >= docTierIdx
    },
    create: ({ req: { user } }) => 
      user?.type === 'admin' || user?.type === 'agent' || user?.tier === 'practitioner-plus',
    update: ({ req: { user }, doc }) =>
      user?.type === 'admin' || user?.id === doc?.addedBy,
    delete: ({ req: { user } }) => user?.type === 'admin'
  },
  hooks: {
    afterChange: [auditLogHook, searchIndexHook, notifySubscribersHook],
    beforeChange: [calculateFingerprint]
  }
}
```

### 7.3 Other collections (specifications)

For brevity, the remaining collections follow the same pattern. Full implementations live in `apps/web/src/collections/`. Below are the essential field lists; access control follows the principle that paid content requires `tier >= practitioner` and creation/editing requires `addedBy === user.id` or `type === 'admin' | 'agent'`.

**Articles** — long-form pieces by Ted, agents, or members.
Fields: `title, slug, authors[], publishDate, body (richText), excerpt, coverImage, topics[], tier, isCompassIssue (bool), compassIssueNumber, discussionCount, reactionCount`.

**Jobs** — job postings, populated by members and Job-Finder agent later.
Fields: `title, slug, company, companyLogo, location, remote (bool), employmentType (full-time/contract/etc.), compensationMin, compensationMax, currency, description (richText), requirements (richText), applyUrl, postedBy, postedDate, expiresAt, isActive, tags[], tier (default practitioner)`.

**Tools** — calculators, simulators, embedded apps.
Fields: `name, slug, description, category (forecasting/scheduling/staffing/etc.), embedUrl (for iframe), sourceCode (link to repo if open), inputs (JSON schema), outputs (JSON schema), createdBy, version, changelog (array), tier`.

**Scenarios** — member-posted real-world WFM situations.
Fields: `title, slug, postedBy, situation (richText), context (group: industry, scale, constraints), askingFor (select: advice/critique/analog/methodology), tier (default practitioner), discussionCount, status (open/resolved/archived)`.

**NewsletterIssues** — Compass archive.
Fields: `issueNumber, title, slug, publishDate, author, body (richText), coverImage, summary, topics[], tier (free for old issues, practitioner for premium edition), sentToMembersAt, openCount, clickCount`.

**Discussions** — threaded comments anchored to objects.
Fields: `parentObjectType (papers/jobs/tools/scenarios/articles/newsletterissues/agents), parentObjectId, parentDiscussionId (for threading, nullable), author, body (richText), reactionCount, isResolved (bool), createdAt, editedAt`.

**Reactions** — likes, helpful votes, bookmarks.
Fields: `member, targetType, targetId, reactionType (like/helpful/bookmark/follow), createdAt`.

**Topics** — taxonomy hierarchy.
Fields: `name, slug, description, parentTopic (self-relation), papersCount, articlesCount, jobsCount, scenariosCount, isFeatured`.

**Plans** — subscription tier definitions.
Fields: `name, slug, stripeProductId, stripePriceIdMonthly, stripePriceIdAnnual, monthlyPrice, annualPrice, currency, features[], tierAccess, isActive, sortOrder`.

**Subscriptions** — Stripe subscription records.
Fields: `member, plan, stripeSubscriptionId, status (active/trialing/past_due/canceled), currentPeriodStart, currentPeriodEnd, cancelAt, trialEnd, createdAt, updatedAt`.

**Notifications** — member notification queue.
Fields: `recipient, type (mention/reply/agent-post/digest/billing/etc.), title, body, linkUrl, isRead, readAt, createdAt, deliveredViaEmail (bool), emailDeliveredAt`.

**Events** — live cohort sessions, AMAs.
Fields: `title, slug, description, scheduledAt, durationMinutes, hostType (member/agent), host, joinUrl, recordingUrl, attendees[], tier, capacity, isPublished`.

**Badges** — member contribution recognition.
Fields: `name, slug, description, iconUrl, criteria, awardedTo[] (members)`.

**AuditLog** — append-only record of significant actions.
Fields: `actor (member), action, targetType, targetId, payload (JSON), ipAddress, userAgent, createdAt`. Indexed on `(actor, createdAt)` and `(targetType, targetId, createdAt)`. Never deleted; archived to R2 after 90 days.

**AgentRuns** (Phase 2+) — log of every agent invocation.
Fields: `agent, workerName, startedAt, finishedAt, status, model, inputTokens, outputTokens, costUsd, metadata (JSON), error, triggerSource (cron/webhook/manual), parentRun (self-relation for nested calls)`.

**Media** — file uploads (PDFs, images, attachments).
Fields: handled by Payload's upload collection pattern, with R2 as the storage adapter. URL transformations for image resizing.

### 7.4 Access control patterns

Reusable access control functions in `apps/web/src/access/`:

```typescript
// tierGate.ts
export const tierGate = (minTier: Tier) => ({ req: { user } }) => {
  const order = ['public', 'free', 'practitioner', 'practitioner-plus', 'founding']
  const userIdx = order.indexOf(user?.tier ?? 'public')
  const minIdx = order.indexOf(minTier)
  return userIdx >= minIdx
}

// isAuthor.ts
export const isAuthor = ({ req: { user }, id }) => 
  user && (user.id === id || user.type === 'admin')

// isPaidMember.ts
export const isPaidMember = ({ req: { user } }) => 
  ['practitioner', 'practitioner-plus', 'founding'].includes(user?.tier)

// isAdmin.ts
export const isAdmin = ({ req: { user } }) => user?.type === 'admin'
```

Access control is **field-level granular** where it matters (e.g., `Papers.fullText` is paid-only even if the paper itself is visible at free tier).

### 7.5 Indexes and performance

Critical indexes (Payload + Postgres):
- `members.email` (unique, auth lookups)
- `members.username` (unique, profile lookups)
- `members.stripeCustomerId` (unique, webhook handling)
- `papers.slug` (unique)
- `papers.sourceFingerprint` (unique, dedup)
- `papers.tier, papers.publishedDate` (composite, browse)
- `discussions.parentObjectType, parentObjectId, createdAt` (composite, comments fetch)
- `auditLog.actor, createdAt` (composite)
- `notifications.recipient, isRead` (composite)
- `subscriptions.stripeSubscriptionId` (unique, webhook handling)

Add indexes via Payload custom DB hooks or migration scripts. Document each index addition in an ADR.

---

## 8. Authentication and Authorization

### 8.1 Authentication flows

**Member signup (free → trial → paid):**
1. Member visits `/signup`, enters email + password + username + displayName + chooses plan
2. Payload creates Member with `tier='free'`
3. Email verification sent via Resend
4. Member clicks verification link, returns to site authenticated
5. If they chose a paid plan, they're redirected to Stripe Checkout
6. On Stripe success webhook, Member's tier is upgraded
7. Welcome email fires (Practitioner welcome template if paid)

**Login:**
- Standard email + password via Payload's auth
- Optional: magic link (`@payloadcms/plugin-passwordless`) for paid members
- Optional: Cloudflare Access SSO for Ted (admin)

**Password reset:**
- Standard Payload flow with custom Resend-based email template

**API authentication for agents (Phase 2+):**
- Each agent Member has `auth.useAPIKey: true`
- API key generated on agent creation, stored in agent's worker as Cloudflare Worker Secret
- All requests use `Authorization: Bearer <api-key>` header
- API key authenticates the request as that specific agent Member
- All writes attributed to the agent

**API authentication for member-owned agents (future):**
- Members can generate personal API keys to connect their own Claude/Cursor agents
- Rate-limited per key
- Read-only access to the content tier they're paying for

### 8.2 Authorization rules

| Action | Free | Practitioner | Practitioner Plus | Founding | Agent | Admin |
|---|---|---|---|---|---|---|
| Read public content | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read free-tier content | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read practitioner content | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read practitioner-plus content | — | — | ✓ | ✓ | ✓ | ✓ |
| Comment on objects | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post jobs | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post scenarios | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post papers | — | — | ✓ | ✓ | ✓ | ✓ |
| Save / bookmark | ✓ (limited) | ✓ | ✓ | ✓ | — | ✓ |
| View member directory | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Direct message members | — | — | ✓ | ✓ | — | ✓ |
| Edit own profile | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Edit other content | — | — | — | — | — | ✓ |
| Manage subscription | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Access admin panel | — | — | — | — | — | ✓ |
| Generate API keys | — | — | ✓ | ✓ | — | ✓ |

Free-tier members on the Hub are people who have signed up but not yet upgraded — they exist primarily as a stepping stone to paid. Most "free" experience happens on Mighty Networks; the Hub free tier is intentionally limited to drive conversion.

---

## 9. Subscription and Payments

### 9.1 Plan structure

| Plan | Monthly | Annual | Stripe Product Slug |
|---|---|---|---|
| Free (Hub limited) | $0 | $0 | `wfmlabs-free` |
| Practitioner | $19 | $190 (save $38) | `wfmlabs-practitioner` |
| Practitioner Plus | $49 | $490 (save $98) | `wfmlabs-practitioner-plus` |
| Founding Member | $99/year (lifetime lock) | — | `wfmlabs-founding` |
| Enterprise | Custom | Custom | `wfmlabs-enterprise` |

### 9.2 Stripe integration architecture

Payload's official `@payloadcms/plugin-stripe` provides:
- Auto-sync of Plans collection to Stripe Products
- Auto-creation of Stripe Customer when Member signs up
- Webhook handler at `/api/stripe/webhook` for subscription events
- Customer Portal session generation for member self-service

Webhook events handled:
- `customer.subscription.created` → set `member.tier` based on plan
- `customer.subscription.updated` → update tier and subscription status
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_failed` → notify member, mark subscription `past_due`
- `customer.subscription.trial_will_end` → notify member 3 days before trial ends

### 9.3 Trial strategy

- New Practitioner signups get 14-day free trial (no credit card required initially? — TBD; alternative is credit card required, charged automatically at trial end)
- Practitioner Plus is paid-only (no trial) — too expensive for free trial abuse
- Founding Member offer is one-time, manually granted to first 100 paid members or by invitation

### 9.4 Checkout flow

```
Member at /pricing
     ↓ (clicks "Start Practitioner trial")
Payload creates trial Subscription record
     ↓
Stripe Checkout session created
     ↓ (member enters card)
Stripe webhook fires customer.subscription.created
     ↓
Payload updates Member.tier='practitioner', subscription record completed
     ↓
Welcome email sent via Resend
     ↓
Member redirected to /me with onboarding tour
```

### 9.5 Customer self-service

- "Manage subscription" link in user menu opens Stripe Customer Portal
- Members can: change plan, update payment method, view invoices, cancel
- All changes flow back via webhook to keep Payload in sync

---

## 10. Content Migration from Mighty Networks

### 10.1 What to migrate

Phase 1 migration target: the 50–100 highest-value pieces of content currently buried in Mighty Networks comment threads and posts.

| Content type | Source | Target collection | Estimated volume |
|---|---|---|---|
| Newsletter back issues | Compass on LinkedIn + WFM Labs Mighty | `NewsletterIssues` | 17 issues |
| Research papers shared in comments | Mighty comment threads | `Papers` | 100–200 |
| Tools / calculators built | WFM Labs Mighty Calculators space | `Tools` | 5–15 |
| Foundational articles | Mighty Articles space | `Articles` | 10–30 |
| Job postings (active) | Mighty Job Hub | `Jobs` | 5–20 active |
| Notable scenarios discussed | Mighty threads | `Scenarios` | 10–25 |

### 10.2 Migration approach

**Manual curation, semi-automated import.**

1. **Audit phase (1 week):** Ted reviews Mighty content and tags items to migrate using a shared spreadsheet with columns: source_url, content_type, title, priority, target_tier, notes.
2. **Bulk import script (`scripts/migrate-from-mighty.ts`):** Reads the curated CSV, fetches each item from Mighty (manually if no API access; via API if Scale plan is active), creates corresponding Payload records.
3. **Beacon-assisted enrichment:** Once Beacon is live (Phase 2), it processes each migrated paper to add summary, why-it-matters, caveats, topic tags. Pre-Beacon, items are migrated with minimal metadata and enriched later.
4. **Author attribution preserved:** Original poster's identity is captured in `originallyPostedBy` field; if they later join the Hub, ownership transfers.

### 10.3 Member migration

**Not in Phase 1 scope.** Existing Mighty members stay on Mighty. The Hub launches with an invite-only beta of 20–50 members.

When ready for broader launch:
1. Generate one-time invitation codes per Mighty member
2. Email invitation with personal upgrade link
3. Member clicks → lands on signup with tier pre-selected
4. Founding Member badge auto-applied if they convert in first wave

### 10.4 Mighty as ongoing funnel

Post-launch, Mighty Networks remains the free top-of-funnel. A future agent (Town Crier, Phase 4+) auto-posts tasteful announcements on Mighty when the Hub publishes new content, with paywall teasers driving conversion.

---

## 11. Agent Integration Architecture (designed Day 1, built Phase 2+)

### 11.1 Why design now, build later

Phase 1 ships without agents but with **the data model, API contracts, and integration points already in place** to support agents added in Phase 2+. This avoids costly refactoring later.

### 11.2 Agent-as-Member pattern

Each agent is a Member with `type='agent'`. They have:
- An email address (`beacon@agents.wfmlabs.com`)
- A username (`beacon`)
- A profile (`bio`, `tagline`, `role`)
- An avatar
- An API key (stored as Cloudflare Worker Secret on the agent's worker)
- A profile page at `/@beacon`
- A presence in member directory
- Posts attributed to them

When Beacon writes a Paper via the API, `Papers.addedBy = beacon.id`. Author attribution preserved automatically. The thing Mighty Networks couldn't do.

### 11.3 Agent runtime: Cloudflare Workers

Each agent is its own Cloudflare Worker:
```
agents/
├── beacon/                                  Phase 2
│   ├── wrangler.toml
│   ├── src/
│   │   ├── workers/
│   │   │   ├── discovery.ts                Cron: scan sources, identify candidates
│   │   │   ├── composition.ts              Cron: compose summary posts
│   │   │   └── reply.ts                    Webhook: respond to comments
│   │   └── lib/
│   ├── identity/                           CLAUDE.md, BELIEFS.md, etc.
│   └── tests/
├── caso/                                   Phase 3
├── job-finder/                             Phase 3
└── almanac/                                Phase 4
```

### 11.4 Communication contracts

**Hub → Agent (webhooks):**
Payload's `afterChange` hooks call agent webhook endpoints when relevant events occur:
- `discussions.afterChange` on Beacon's papers → POST to Beacon worker `/handle-comment`
- `papers.afterChange` (create) → POST to all agents' `/notify-paper-created` endpoint

**Agent → Hub (REST API):**
Agents call Payload's REST API with their API key:
- `POST /api/papers` to publish a research summary
- `POST /api/discussions` to comment on a member's post
- `GET /api/papers?where={...}` to query existing content for memory

**Agent → Agent (A2A protocol):**
Each agent exposes an A2A endpoint with a public Agent Card. Cross-agent collaboration uses the A2A standard. Designed Day 1; meaningful only when 2+ agents exist.

**Member-owned agents → Hub (MCP):**
The Hub exposes its content as MCP servers. Members can configure their own Claude/Cursor/etc. agents to read WFM Labs content directly. This becomes the "every member has personal agent leverage" feature.

### 11.5 Agent observability

`AgentRuns` collection logs every agent invocation with cost telemetry. Admin dashboard shows daily spend, error rate, latency per agent.

`AgentMemory` (Phase 2+ collection) holds per-agent persistent state — what they've published, what they've learned, what positions they hold. Each agent has its own memory namespace.

### 11.6 Cost guardrails

Each agent worker enforces:
- Daily cost cap (default $5/day, configurable per agent)
- Per-call max input/output tokens
- Circuit breaker that disables agent when cap hit
- Daily summary email to Ted with spend report

---

## 12. Open MCT / Roc.Cloud Integration (designed Day 1, built Phase 3)

### 12.1 Strategic role

Roc.Cloud is the operations center: real-time WFM telemetry across industries, anomaly detection, the volatility index (O-VIX), member-watched live incidents. It is the gravitational pull that makes the Hub feel alive in a way no SaaS community can.

Roc runs on **Open MCT** (NASA Ames's open-source mission control framework), self-hosted at `roc.wfmlabs.com`. The Hub at `community.wfmlabs.com` integrates with Roc but does not host it.

### 12.2 Integration patterns

**Pattern 1: Embedded Open MCT views inside Hub object pages.** A Scenario or Paper that discusses a real incident embeds the live or historical Open MCT view of the data via iframe or direct API. Members see live telemetry alongside the discussion thread.

**Pattern 2: Roc-driven Hub objects.** When Roc detects a noteworthy anomaly, it creates a `Scenario` in the Hub via API, with `liveDataUrl` pointing to the Open MCT view. Members see "Roc detected a pattern at $UnnamedRetailer at 14:32 ET — discuss" with the live data embedded. Beacon and Caso may comment with relevant research and historical analogs respectively.

**Pattern 3: Member-pinned Roc dashboards.** Members configure Open MCT layouts that they care about (queue volatility, abandonment trends, scheduling adherence). The Hub remembers their pinned views and surfaces them on the dashboard.

**Pattern 4: Cross-system identity.** SSO between Hub and Roc so members move seamlessly. Cloudflare Access sits in front of both.

### 12.3 Phase 3 implementation scope

Phase 3 (estimated weeks 10–16 from Phase 1 launch) ships:
- Roc.Cloud running Open MCT at `roc.wfmlabs.com`
- One real or synthetic data source feeding it
- Hub `/scenarios/[slug]` page can embed an Open MCT view via iframe
- Roc-driven scenario creation works end-to-end with one demo incident
- SSO between the two systems

This is a meaningful build but it benefits from Phase 1 having established the data model, the agent integration points, and the design language. Roc layers on top rather than living inside.

---

## 13. Email and Notifications

### 13.1 Email categories

| Category | Trigger | Template | Tier |
|---|---|---|---|
| Welcome (free) | Signup | `WelcomeEmail` | All |
| Welcome (Practitioner) | Tier upgrade | `PractitionerWelcome` | Paid |
| Email verification | Signup | `EmailVerification` | All |
| Password reset | User request | `PasswordReset` | All |
| Discussion reply | New reply on object you authored or follow | `DiscussionReply` | Paid (free gets digest only) |
| Mention | Member or agent mentions you | `Mention` | Paid |
| Agent published | Beacon publishes a paper in topics you follow | `AgentPublished` | Paid |
| Weekly digest | Cron weekly | `WeeklyDigest` | Free + Paid |
| Trial ending | 3 days before trial end | `TrialEnding` | Trial members |
| Payment failed | Stripe webhook | `PaymentFailed` | Paid |
| Subscription canceled | Stripe webhook | `SubscriptionCanceled` | Recently canceled |
| Invitation to upgrade | Manual or campaign | `UpgradeInvitation` | Free |

### 13.2 Email infrastructure

- **Resend** as transactional email provider (Ted has account)
- **React Email** for templates (TypeScript, type-safe, looks great)
- Templates live in `apps/web/src/emails/`
- Bounce and complaint handling via Resend webhooks → update member's `emailStatus`
- Unsubscribe links generated per-recipient with signed token; click returns `member.preferences.emailNotifications=false`
- DKIM/SPF/DMARC set up for `wfmlabs.com` domain

### 13.3 In-app notifications

- `Notifications` collection holds pending notifications for each member
- Bell icon in nav shows unread count
- Notifications page at `/me/notifications` shows full history
- Real-time updates via Server-Sent Events or polling (poll every 60s for v1, upgrade to SSE if needed)
- Email delivery is parallel to in-app; member can disable email per category

### 13.4 Newsletter delivery

- Compass issues stored as `NewsletterIssues` records
- Sent via Resend Broadcast API to opted-in members (`preferences.weeklyDigest = true`)
- For up to 2,500 subscribers, Resend handles delivery directly
- If subscriber count grows past 2,500, evaluate Beehiiv as dedicated newsletter platform

---

## 14. Search and Discovery

### 14.1 Meilisearch architecture

Meilisearch indexes:
- `papers` — title, authors, abstract, curatorSummary, topics
- `articles` — title, body, topics, author
- `jobs` — title, company, description, tags
- `tools` — name, description, category
- `scenarios` — title, situation, askingFor
- `members` — username, displayName, profile.title, profile.company, profile.expertise
- `agents` — username, displayName, agentMetadata.role, agentMetadata.tagline
- `topics` — name, description

Each index has typo-tolerant search, filterable attributes (tier, date, author, topic), sortable attributes (date, relevance, popularity).

### 14.2 Sync strategy

- Payload `afterChange` hook on each indexed collection pushes update to Meilisearch
- `afterDelete` hook removes from index
- Nightly reindex job catches any drift
- Search results filtered by user's tier at query time

### 14.3 Hosting

- Meilisearch self-hosted on Hetzner CX22 ($5/mo) for v1
- Upgrade to Meilisearch Cloud ($25/mo) when index size or query volume justifies

---

## 15. Operational Excellence

This section is critical and Ted asked for it explicitly. The platform is built for long-term operation, not for a launch demo.

### 15.1 Change management

**Conventional commits.** All commits follow `type(scope): description` format (feat/fix/docs/chore/refactor/test). Enforced by commitlint pre-commit hook.

**CHANGELOG.md** auto-generated by Changesets. Every PR that affects users includes a changeset describing the change. CHANGELOG updated on every release.

**Architecture Decision Records (ADRs).** Every significant decision gets an ADR in `MEMORY/decisions/NNNN-decision-name.md` following the format:

```markdown
# ADR NNNN: [Title]

Date: YYYY-MM-DD
Status: [Proposed | Accepted | Deprecated | Superseded by ADR-MMMM]
Authors: [names]

## Context
[What problem are we solving?]

## Decision
[What did we decide?]

## Alternatives considered
[What else did we look at, and why did we reject it?]

## Consequences
[What does this make easier? Harder? What new risks?]

## Notes
[Any references, links, follow-ups]
```

ADRs are immutable once Accepted. To change a decision, write a new ADR that supersedes the old one.

**Pull request template** in `.github/PULL_REQUEST_TEMPLATE.md` requires every PR to include:
- What changed
- Why it changed (link to issue or ADR)
- How to test it
- Screenshots if UI changed
- Breaking change indicator

### 15.2 Quality assurance

**Testing pyramid:**
- **Unit tests (Vitest):** every utility function, every access control function, every hook. ~70% of tests.
- **Integration tests (Vitest + Neon dev branch):** every collection's CRUD operations, every API route, every Stripe webhook handler. ~20% of tests.
- **E2E tests (Playwright):** critical user flows — signup, login, browse research, view paper, post comment, upgrade subscription, manage subscription. ~10% of tests.

**Coverage targets:** 80% line coverage, 100% on access control and Stripe webhook handlers.

**CI runs on every PR:**
- TypeScript typecheck
- ESLint
- Prettier check
- Unit + integration tests
- Build succeeds
- Playwright smoke tests
- Lighthouse CI for performance regressions
- Visual regression (Chromatic, optional Phase 1)

**Pre-commit hooks (Husky + lint-staged):**
- Format with Prettier
- Lint with ESLint
- Typecheck changed files

**Code review:** Ted is sole approver for v1; PRs from TARS get reviewed before merge to main. Once stable, dependabot PRs auto-merge after CI passes.

### 15.3 Observability

**Error tracking:** Sentry captures all unhandled errors in client and server. Alerts to Ted on new error types.

**Performance monitoring:** Vercel Analytics + Sentry Performance. Monitor:
- Core Web Vitals (LCP, FID, CLS)
- API response times (P50, P95, P99)
- Database query times
- Background job duration

**Logging:** Structured logs (JSON) shipped to Axiom. Log levels: error, warn, info, debug. Production runs at `info` level.

**Synthetic monitoring:** Better Uptime checks every minute:
- Homepage loads in <3s
- API health endpoint returns 200
- Login page reachable
- Stripe webhook endpoint reachable

**Alerts:** Sentry → Ted's email + (optional) phone for critical errors. Better Uptime → Ted's email for downtime.

### 15.4 Backups and disaster recovery

**Database (Neon):**
- Neon Free tier: 7 days point-in-time recovery
- Upgrade to Neon Scale ($69/mo) when production-critical data exists, for 30-day PITR
- Nightly logical dump exported to R2 via GitHub Actions cron job (`scripts/backup-db.ts`)
- Retain dumps for 90 days; archive monthly snapshots indefinitely

**Object storage (R2):**
- Versioning enabled on bucket
- Lifecycle rule: keep current + last 30 versions of each object
- Cross-bucket replication for critical files (planned, Phase 2+)

**Source code (GitHub):**
- Primary repo `wfmlabsorg/wfmlabs-hub`
- Mirror to `~/cloud/projects/wfmlabs-hub-mirror` via cron
- Fork on Codeberg as additional mirror (planned)

**Secrets:**
- Vercel environment variables backed up via `vercel env pull` weekly to encrypted file in R2
- sops-encrypted secrets in repo for shared dev env vars

**Restore runbook:** `MEMORY/runbooks/restore-db.md` documents step-by-step recovery from each backup type. Tested quarterly.

**Disaster scenarios documented:**
- Vercel outage → fallback to Netlify (deploy script ready in `infrastructure/`)
- Neon outage → restore from latest dump on a new Postgres instance
- R2 outage → switch storage adapter to S3-compatible alternative
- GitHub outage → push from local mirror to alternate Git host
- Compromised credentials → rotation runbook in `MEMORY/runbooks/rotate-secrets.md`

### 15.5 Performance and scale

**Phase 1 targets:**
- Lighthouse Performance score > 90
- LCP < 2.5s on 4G
- TTFB < 600ms
- Database query P95 < 100ms
- Search query P95 < 200ms

**Scaling levers (in order of when to use):**
1. ISR (incremental static regeneration) for content pages — turn on Day 1
2. Edge caching at Cloudflare — Day 1
3. Neon read replicas — when DB CPU > 60% sustained
4. Meilisearch dedicated host — when search > 100 QPS
5. Vercel Pro tier — when Hobby limits hit
6. Database sharding by tenant — never (we're single-tenant)

### 15.6 Security

**Standard hardening:**
- HTTPS everywhere (Vercel automatic + Cloudflare in front)
- HSTS enabled
- CSP headers configured (`next.config.ts`)
- All input validated with Zod schemas
- All output sanitized (Payload + React handle automatically)
- SQL injection: not possible (Payload uses parameterized queries)
- XSS: not possible if using React correctly
- CSRF: Payload built-in protection on admin; SameSite cookies on auth
- Rate limiting on auth endpoints (Vercel + Cloudflare)
- Secrets never logged or committed (sops + age + `.gitignore`)

**Privacy:**
- Privacy policy and Terms of Service published from Day 1
- GDPR-compliant data export (member can request copy of all their data)
- GDPR-compliant deletion (member can request account deletion → soft delete + 30-day permanent)
- Cookie banner only if needed (Plausible doesn't require it; PostHog might)
- Analytics opt-out per member

**Audit:**
- Quarterly review of access controls
- Annual penetration test (defer to Phase 4+)
- Dependency vulnerability scanning via Dependabot

### 15.7 Cost monitoring

`scripts/cost-report.ts` runs weekly, pulling spend from:
- Vercel API
- Neon API
- Cloudflare API
- Anthropic API
- Stripe API
- Resend API
- Hetzner API (for Meilisearch host)

Outputs a markdown report with weekly delta and alerts if any line item exceeds budget. Email to Ted Mondays.

---

## 16. TARS Memory System

### 16.1 Why this matters

TARS works with Ted across many sessions on this project. Each session, TARS may forget context from previous sessions. The platform itself accumulates decisions, revisions, learnings, and operational knowledge that must persist.

The TARS Memory System is the canonical record of "what we know about this project right now" that any TARS session can read at the start to come up to speed quickly.

### 16.2 Directory structure

```
~/cloud/projects/wfmlabs-hub/MEMORY/
├── README.md                     How TARS uses this directory
├── decisions/                    Architecture Decision Records
│   ├── 0001-payload-cms.md
│   ├── 0002-vercel-hosting.md
│   ├── 0003-two-platform-strategy.md
│   ├── 0004-tier-structure.md
│   └── ...
├── context/                      Snapshot of current state
│   ├── current-state.md          What exists, what's deployed, what's working
│   ├── known-issues.md           Open bugs, ongoing problems
│   ├── tech-debt.md              What we know we should fix
│   └── data-model-current.md     Latest data model summary
├── learnings/                    Insights from build experience
│   ├── 2026-05-09-payload-postgres-gotcha.md
│   └── ...
├── revisions/                    Major doc revision logs
│   ├── seed-doc-v1-to-v1.1.md
│   └── ...
├── runbooks/                     Operational procedures
│   ├── deploy.md
│   ├── rollback.md
│   ├── restore-db.md
│   ├── rotate-secrets.md
│   ├── invite-member.md
│   ├── handle-stripe-webhook-failure.md
│   └── reindex-search.md
└── session-notes/                Per-session work logs (TARS writes here)
    ├── 2026-05-09-1430-phase1-bootstrap.md
    └── ...
```

### 16.3 Read-on-startup pattern

Every TARS session on this project begins by reading:
1. `MEMORY/README.md` (the index)
2. `MEMORY/context/current-state.md`
3. The 5 most recently modified ADRs in `MEMORY/decisions/`
4. The 3 most recent session notes in `MEMORY/session-notes/`
5. `CHANGELOG.md` last 20 entries

This is encoded in a `~/pai/skills/WFMLabsHub/SKILL.md` skill (created Day 1) that triggers on any prompt mentioning the project.

### 16.4 Write-on-completion pattern

Every TARS session that completes meaningful work writes:
1. A session note to `MEMORY/session-notes/YYYY-MM-DD-HHMM-{topic}.md`
2. An ADR if a significant decision was made
3. An update to `MEMORY/context/current-state.md` if the system state changed
4. A learning to `MEMORY/learnings/YYYY-MM-DD-{topic}.md` if something was discovered

### 16.5 Session note template

```markdown
# Session: [Topic]

Date: YYYY-MM-DD HH:MM
Duration: ~Xh
Driver: Ted Lango
Co-pilot: TARS
Phase: [1|2|3|4]

## Goal
[What did we set out to do?]

## What we did
[Bulleted list of actions taken, files changed, decisions made]

## What we learned
[New information that changes how we think about the project]

## What's next
[Open items, follow-ups, blockers]

## Files changed
[List with one-line description each]

## ADRs created or updated
[Links to ADRs]
```

### 16.6 ADR numbering

ADRs are numbered sequentially in `decisions/NNNN-name.md` format. ADR 0001 is reserved for "We chose Payload CMS as our backend." ADR 0002 is "We chose Vercel for hosting." Etc. Initial ADRs documenting the seed doc's key decisions:

| ADR | Title |
|---|---|
| 0001 | Payload CMS as backend |
| 0002 | Vercel for application hosting |
| 0003 | Two-platform strategy (Mighty free, Hub paid) |
| 0004 | Tier structure (Practitioner $19, Plus $49, Founding $99/year) |
| 0005 | Object-anchored architecture (no feed) |
| 0006 | Cloudflare R2 for object storage |
| 0007 | Resend for transactional email |
| 0008 | Neon Postgres with branching for previews |
| 0009 | Meilisearch for search |
| 0010 | Stripe for payments via Payload plugin |
| 0011 | Cloudflare Workers for agent runtime (Phase 2+) |
| 0012 | Open MCT for Roc.Cloud (Phase 3+) |
| 0013 | Members + Agents in single collection (with `type` field) |
| 0014 | TypeScript + Bun + Next.js 15 + React 19 |
| 0015 | Monorepo with Turborepo |

These should be written to the repo on Day 1 of the build.

### 16.7 The WFMLabsHub TARS skill

A new skill at `~/pai/skills/WFMLabsHub/SKILL.md` defines:

```yaml
triggers: ["wfmlabs hub", "community.wfmlabs.com", "the hub", "payload hub", "wfm hub"]
workflows: ["bootstrap", "deploy", "data-model-change", "create-collection", "invite-member"]
agents: []
dependencies: ["~/cloud/projects/wfmlabs-hub/"]
```

The skill instructs TARS to:
1. Read `MEMORY/context/current-state.md` first
2. Reference this seed doc as source of truth
3. Write session notes after meaningful work
4. Create ADRs for any deviation from the seed doc
5. Bump the seed doc version when revising it

---

## 17. Phased Build Plan

### 17.1 Phase 1: Foundation (current scope, weeks 1–6)

**Goal:** Working platform with content, members, payments, but no agents yet.

**Deliverables:**
- Repo bootstrapped with monorepo structure
- Payload CMS configured with all collections from Section 7
- Next.js frontend with the five page templates from Section 4.2
- Authentication and tier-gated access control working
- Stripe integration with Practitioner and Practitioner Plus plans
- Resend email integration with all transactional templates
- Meilisearch integration with reindex capability
- Migration script for Mighty content
- Initial 50–100 papers, 5–15 tools, 10–30 articles migrated
- Compass newsletter archive (17 issues)
- Admin user (Ted), 1–2 founding test member accounts
- All operational practices from Section 15 in place
- TARS Memory System active
- 20 invited members onboarded successfully

**Out of scope for Phase 1:**
- Agents (Beacon, Caso, etc.)
- Open MCT / Roc.Cloud integration
- Mobile app
- Advanced search features (semantic, agent-powered)
- Member-to-member direct messaging
- Live events
- Mighty migration of free-tier members (they stay)

### 17.2 Phase 2: Beacon (weeks 6–10)

**Goal:** First agent (research librarian) operating in the Hub.

**Deliverables:**
- Beacon Member account created with API key
- Beacon Cloudflare Worker built (discovery, composition, reply)
- Daily research summaries posted by Beacon
- Beacon responds to comments on his papers
- AgentRuns logging operational
- Cost dashboard working
- Member-facing "Beacon" profile page
- Notification system surfacing Beacon's activity to subscribers

### 17.3 Phase 3: Roc.Cloud and Open MCT (weeks 10–16)

**Goal:** Live operations integration.

**Deliverables:**
- Open MCT instance at `roc.wfmlabs.com`
- One real or synthetic data source feeding it
- Hub Scenarios can embed Open MCT views
- Roc-driven scenario creation works end-to-end
- SSO between Hub and Roc

### 17.4 Phase 4: Multi-agent ecosystem (weeks 16+)

**Goal:** Caso, Job-Finder, Almanac, Town Crier come online progressively.

**Deliverables (per agent):**
- Member account + API key
- Worker runtime
- Identity files and personality
- First production posts
- Member-facing presence

---

## 18. Success Metrics

### 18.1 Phase 1 success criteria

| Metric | Target by end of Phase 1 |
|---|---|
| Content migrated | 50+ papers, 17 newsletter issues, 5+ tools |
| Beta members signed up | 20 |
| Beta members converted to paid | 10 |
| Pages with full Lighthouse Performance > 90 | 100% of public pages |
| Test coverage | >70% line coverage |
| Critical bugs at launch | 0 |
| Time to first contentful paint (P50) | <1.5s |
| Stripe webhook handler error rate | <0.1% |

### 18.2 Phase 2 success criteria

| Metric | Target |
|---|---|
| Beacon daily posts | 1–3 per day, 7 days/week |
| Beacon comment response rate | >80% on member questions |
| Member daily active (paid tier) | >40% |
| Beacon API cost | <$5/day average |
| Member-reported quality of Beacon posts | "good" or better, 80%+ |

### 18.3 Long-term success metrics (12 months)

| Metric | Target |
|---|---|
| Paid members | 100+ |
| Monthly recurring revenue | $2,500+ |
| Free → paid conversion rate | 10%+ of Mighty members |
| Daily active member rate (paid) | >60% |
| Net revenue retention | >100% |
| Content library size | 500+ papers, 50+ tools, 100+ scenarios |

---

## 19. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Payload 3.x has unexpected production issues | Medium | High | Pin versions; Strapi as documented escape hatch |
| Vercel pricing escalates | Low | Medium | Netlify and self-hosted alternatives documented |
| Free tier on Mighty deteriorates further | Medium | Medium | Hub already provides home if forced migration needed |
| Conversion rate too low | Medium | High | Beta with 20 members validates before broader launch |
| Anthropic API costs spike with multiple agents | Medium | Medium | Hard cost caps per agent; model routing rules |
| Solo developer (Ted) hit by bus | Low | Catastrophic | Documentation, ADRs, runbooks make handoff possible |
| Mighty Networks shuts down free tier abruptly | Low | High | Hub ready to absorb free members within weeks |
| Content quality from Beacon disappoints | Medium | Medium | Phase 2 dry-run period validates before public exposure |
| Tier gating bug exposes paid content for free | Low | High | Comprehensive access control tests; periodic security audit |
| Stripe webhook failures cause subscription state drift | Medium | Medium | Reconciliation script runs nightly; alerts on drift |

---

## 20. Open Questions

These are questions to resolve as Phase 1 progresses, tracked as GitHub issues with the `decision-needed` label:

1. **Free trial: credit card required upfront, or not?** Tradeoff: card-required reduces signup but reduces churn. No-card increases signup but increases trial abuse. Recommend no-card for first 3 months, switch to card-required if abuse becomes meaningful.

2. **Discussion threading depth:** flat replies only, or nested? Recommend flat with @-mentions (simpler UI, easier moderation).

3. **Search: Meilisearch or Typesense?** Both viable. Meilisearch chosen for slightly better TypeScript ergonomics; revisit if specific Typesense feature becomes needed.

4. **Mobile-first or desktop-first design?** Recommend desktop-first for v1 (members are knowledge workers at desks); mobile-responsive but not native app.

5. **Public visibility of paid content abstracts:** are Practitioner papers' titles and abstracts visible to free / unauthenticated users, or fully gated? Recommend titles + abstracts public for SEO; full text gated.

6. **Member directory privacy default:** opt-in or opt-out? Recommend opt-out (members listed by default, can hide if desired).

7. **Annual billing default:** offer monthly or annual as default on /pricing? Recommend annual with "save $38" highlight.

8. **TLD strategy for sub-properties:** roc.wfmlabs.com, compass.wfmlabs.com — yes? Recommend yes, all paid sub-properties on .com.

---

## Appendix A: ADR template

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
- [What this makes harder, what we give up, what new risks]

## Implementation notes

[Specific details about how this is implemented or migrated to]

## Follow-ups

- [ ] [Open task related to this decision]

## References

- [Link to seed document section]
- [Link to related ADRs]
- [External references]
```

---

## Appendix B: Initial Topics taxonomy

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

## Appendix C: Initial environment variables

`.env.example` should include (with placeholder values):

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

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@community.wfmlabs.com

# Search
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=

# Analytics
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=community.wfmlabs.com

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Logs
AXIOM_TOKEN=
AXIOM_DATASET=

# Feature flags
ENABLE_AGENT_INTEGRATION=false
ENABLE_OPEN_MCT_EMBED=false
```

---

# 17. TARS Phase 1 Launch Prompt

The following prompt is what gets pasted into a fresh TARS Claude Code session to begin Phase 1 implementation. It references this seed document and specifies the build sequence.

---

## TARS BUILD PROMPT — WFM Labs Hub Phase 1: Foundation

**Project codename:** WFM Labs Hub
**Phase:** 1 of 4 — Foundation (no agents, no Open MCT)
**Reference document:** `~/cloud/projects/wfmlabs-hub/wfmlabs-platform-seed-v1.md` (this document)
**Algorithm phase:** EXECUTE with explicit OBSERVE checkpoint at the start
**Estimated effort:** 4–6 weeks of focused TARS work
**Outcome:** Deployable platform at `community.wfmlabs.com` with content migrated, payments working, 20 beta members onboardable

### OBSERVE checkpoint

Before any code is written, TARS must:

1. Read this entire seed document end to end. It is the source of truth.
2. Read `~/pai/TELOS/PROJECTS.md` to understand how this project relates to Ted's broader work.
3. Read `~/pai/MEMORY/Learning/EXECUTE/` for any prior learnings that may apply.
4. Confirm in writing back to Ted that you understand:
   - The two-platform strategy (Mighty free / Hub paid)
   - That Phase 1 explicitly excludes agents and Open MCT
   - The five page templates (card, detail, browse, profile, org)
   - The Member-as-Agent pattern (designed Day 1, used Phase 2)
   - The TARS Memory System and your obligation to use it

If any aspect is unclear, ask before proceeding.

### Build sequence

Execute in this order. Each step has verifiable end state. Write a session note to `MEMORY/session-notes/` after each step.

#### Week 1: Repo, infrastructure, and TARS memory

1. Create `~/cloud/projects/wfmlabs-hub/` directory
2. Initialize git, push to `wfmlabsorg/wfmlabs-hub` on GitHub
3. Set up monorepo structure per Section 6.1
4. Create `MEMORY/` directory and seed it with:
   - README explaining usage
   - ADRs 0001–0015 from Section 16.6 (one file each)
   - Initial `context/current-state.md`
   - All runbook stubs (deploy, rollback, restore-db, rotate-secrets)
5. Create `~/pai/skills/WFMLabsHub/SKILL.md` skill per Section 16.7
6. Set up GitHub Actions workflows per Section 6.1
7. Create Vercel project, link to GitHub repo, set up preview deployments
8. Create Neon project, get connection string
9. Create Cloudflare R2 bucket `wfmlabshub-media`
10. Configure all environment variables in Vercel and `.env.local`

End state: empty Next.js app deploys to a preview URL on every PR.

#### Week 2: Payload backbone

11. Install Payload 3.x with all required adapters
12. Configure `payload.config.ts` with Postgres adapter, R2 storage, Lexical rich text
13. Create initial collections: `Members`, `Plans`, `Subscriptions`, `Topics`, `Media`
14. Wire Payload's auth to support email + password
15. Build initial admin user creation script
16. Verify admin UI at `/admin` works
17. Verify auto-generated REST API at `/api/members` works
18. Generate types via `payload generate:types`
19. Add ESLint, Prettier, Vitest, Playwright configs
20. Add pre-commit hooks via Husky

End state: Payload admin UI accessible, can create test members, types generate cleanly.

#### Week 3: Content collections and migration

21. Create remaining content collections from Section 7: `Papers`, `Articles`, `Jobs`, `Tools`, `Scenarios`, `NewsletterIssues`, `Discussions`, `Reactions`, `Notifications`, `Events`, `Badges`, `AuditLog`
22. Implement access control functions in `apps/web/src/access/`
23. Implement audit log hook
24. Seed `Topics` from Appendix B
25. Build `scripts/migrate-from-mighty.ts` that reads a CSV of curated content and creates Payload records
26. Have Ted produce the curation CSV (50+ papers, 17 newsletters, 5+ tools)
27. Run migration script; verify data in admin UI

End state: real WFM Labs content accessible via API, browseable in admin UI.

#### Week 4: Frontend foundation

28. Set up Tailwind CSS + shadcn/ui in `apps/web`
29. Build design tokens in `packages/design-system`
30. Build the five page templates in `apps/web/src/components/pages/`
31. Build card components in `apps/web/src/components/cards/` for each object type
32. Implement homepage at `/` (org page pattern)
33. Implement `/research` browse page
34. Implement `/research/[slug]` detail page
35. Implement same for `/jobs`, `/tools`, `/scenarios`, `/compass`, `/agents` (placeholder), `/members`, `/@username`
36. Implement global navigation and search bar (search not functional yet)
37. Implement light/dark theme toggle

End state: site visually complete, browsable, looks like the WFM Labs brand.

#### Week 5: Auth, payments, email

38. Install Stripe plugin, configure with test keys
39. Create Plans (Practitioner, Practitioner Plus, Founding) in Stripe and sync to Payload
40. Implement signup flow at `/signup`
41. Implement login flow at `/login`
42. Implement password reset flow
43. Implement Stripe Checkout session creation
44. Implement Stripe webhook handler at `/api/stripe/webhook`
45. Implement subscription tier upgrade/downgrade based on Stripe events
46. Wire Resend with all email templates from Section 13.1
47. Implement notification system (in-app + email)
48. Test complete signup → trial → upgrade → cancellation flow

End state: members can sign up, pay, and have correct tier-gated access.

#### Week 6: Search, polish, hardening, beta launch

49. Set up Meilisearch on Hetzner
50. Implement search index sync hooks
51. Implement `/api/search` endpoint and global search UI
52. Run Lighthouse audits, fix performance regressions
53. Run Playwright E2E tests on critical flows; fix failures
54. Set up Sentry, Axiom, Better Uptime, Plausible
55. Document all runbooks; verify each by walking through it
56. Generate first weekly cost report
57. Invite 20 beta members manually
58. Monitor onboarding, fix issues as they arise

End state: 20 paying beta members on the platform, 0 critical bugs, all observability green.

### VERIFY checklist

Before declaring Phase 1 complete:

- [ ] All Section 7 collections exist and are functional
- [ ] All five page templates render correctly across object types
- [ ] Authentication and authorization work for all tier levels
- [ ] Stripe Checkout completes end-to-end
- [ ] Stripe webhook updates Payload correctly
- [ ] Resend delivers all transactional email categories
- [ ] Search returns relevant results across all object types
- [ ] 50+ papers, 17 newsletter issues, 5+ tools migrated and visible
- [ ] 20 beta members successfully onboarded
- [ ] Lighthouse Performance > 90 on all public pages
- [ ] Test coverage > 70% line coverage
- [ ] All runbooks tested at least once
- [ ] Database backup script runs nightly and dump verified restorable
- [ ] All ADRs (0001–0015) written
- [ ] CHANGELOG.md generated for v1.0.0 release
- [ ] `MEMORY/context/current-state.md` reflects accurate post-launch state
- [ ] No critical Sentry errors in last 7 days

### LEARN phase

After Phase 1 completes, write to `MEMORY/learnings/`:

1. What surprised us about Payload in production?
2. What design decisions in this seed doc proved wrong or needed revision?
3. What patterns from the build should be promoted to skills for Phase 2 reuse?
4. What did the 20 beta members like / dislike / find confusing?
5. What's the actual measured cost / month?
6. What's the right Phase 2 scope based on Phase 1 learnings?

Update this seed document to v1.1 reflecting any decisions that diverged from v1.0.

### Out of scope for Phase 1

Explicitly defer:

- ❌ All AI agents (Beacon, Caso, Job-Finder, etc.)
- ❌ Open MCT / Roc.Cloud integration
- ❌ Mobile native app
- ❌ Member-to-member direct messaging
- ❌ Live events / cohort sessions
- ❌ Mighty Networks free-tier migration
- ❌ Multi-language support
- ❌ Advanced personalization
- ❌ Recommendation engine
- ❌ Public discussion outside member-only access

### Notes for TARS during execution

- This is a real production system; build accordingly with tests, error handling, logging from Day 1
- When you hit ambiguity not addressed in this document, write a question to `MEMORY/context/current-state.md` under "Open Questions" and surface to Ted; do not guess
- Update ADRs whenever you make a choice that wasn't explicitly specified
- Capture every meaningful learning to `MEMORY/learnings/` as you go
- Use the Algorithm: OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN
- The platform is the product; treat the build with the care that implies

End of Phase 1 launch prompt.

---

# Document Maintenance

This seed document will be revised as the platform evolves. Major revisions:

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0 | 2026-05-09 | Ted Lango + Claude (planning session) | Initial seed |

Revision protocol:
1. Edit this file
2. Bump version at top
3. Add row to maintenance log above
4. Write ADR explaining what changed and why
5. Commit with message `docs(seed): bump to vX.Y — [summary]`

End of Seed Document v1.0.
