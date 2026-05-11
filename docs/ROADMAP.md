# WFM Labs Hub — Roadmap

**Last updated:** 2026-05-10
**Source of truth for:** phased build plan, what's done, what's next

---

## Phase Overview

| Phase | Focus | Status | Timeline |
|-------|-------|--------|----------|
| **1A** | Platform foundation + CMS | **Complete** | May 9-10 |
| **1B** | Frontend + content seeding | **In Progress** | May 10-12 |
| **1C** | Cross-cutting infrastructure | **In Progress** | May 10-12 |
| **2A** | Wiki + Frameworks sections | Planned | May 12-16 |
| **2B** | Beacon agent (Phase 1: read-only) | Planned | May 16-23 |
| **2C** | Beacon engagement loop | Planned | May 23-30 |
| **3** | Commerce layer (Stripe, tiers) | Planned | June |
| **4** | ROC/OpenMCT integration | Planned | July+ |

---

## Phase 1A: Platform Foundation (Complete)

**Goal:** Payload CMS running, admin accessible, basic collections.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Git repo (wfmlabsorg/wfmlabs-hub) | Done | Public repo |
| Payload CMS 3.84.1 + Next.js 15 | Done | |
| Neon Postgres (dedicated project) | Done | Credentials in sops |
| Cloudflare R2 (wfmlabs-media bucket) | Done | |
| Vercel deployment | Done | wfmlabs-hub-local.vercel.app |
| Admin panel working | Done | ted@wfmlabs.com account |
| Members collection (with auth) | Done | Agent-as-Member pattern |
| Media collection (R2 storage) | Done | |
| TARS session infrastructure | Done | CLAUDE.md, MEMORY, ADRs, skill |
| Seed doc v1.1 | Done | Source of truth |
| WLAA asset architecture doc | Done | Content structure spec |
| 15 ADRs | Done | Key decisions documented |

**Learnings:**
- Netlify can't handle Payload server actions → Vercel required (ADR-0002)
- importMap.js must be generated, never hand-written
- WSL2 cloud-synced dirs too slow for node_modules → local dev dir

---

## Phase 1B: Frontend + Content (In Progress)

**Goal:** HF-inspired browse and detail pages with real content.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| HF-inspired design system (CSS custom properties) | Done | Yellow accent, dark/light mode |
| GlobalNav (Tools, Research, Wiki, Frameworks, Scenarios, Members) | Done | |
| Homepage with live stats + content grid | Done | force-dynamic for fresh data |
| AssetCard component (HF Spaces gradient style) | Done | Category-coded gradients |
| Tools browse page with category chips | Done | 5 tools seeded |
| Tool detail page with embedded iframe | Done | Live calculator embed |
| Research browse page | Done | 15 papers seeded |
| Research detail page | Done | Curator summary, why it matters, caveats |
| Wiki browse page | Pending | Beacon-curated highlights model |
| Wiki detail page | Pending | Links back to wiki.wfmlabs.org |
| Frameworks browse page | Stubbed | "Coming soon" |
| Frameworks detail page | Stubbed | Needs collection creation |
| Scenarios browse page | Stubbed | "Coming soon" |
| Member profiles | Done (basic) | /member/[username] |
| About page | Done | |
| Topics taxonomy seeded | Pending | Script ready, needs execution |

---

## Phase 1C: Cross-Cutting Infrastructure (In Progress)

**Goal:** Discussion, reactions, and engagement layer that works on every asset type.

| Deliverable | Status | Notes |
|-------------|--------|-------|
| DiscussionSection component | Done | Server component, any asset type |
| DiscussionEntry component | Done | GitHub-style comment layout |
| DiscussionForm component | Done | Client component, auth-gated |
| POST /api/discussions endpoint | Done | Text → Lexical conversion |
| ReactionBar component | Done | 4 emoji toggles, optimistic UI |
| POST /api/reactions endpoint | Done | Toggle create/delete |
| Wired into Tool detail | Done | Proof of concept |
| Wire into Research detail | Pending | Same components, just add |
| Wire into Wiki detail | Pending | |
| AssetRelationships UI (sidebar) | Pending | Collection exists, needs UI |
| AssetContributions UI (credits) | Pending | Collection exists, needs UI |
| AssetVersions UI (history) | Pending | Collection exists, needs UI |

---

## Phase 2A: Wiki + Frameworks (Planned)

**Goal:** Wiki section as Beacon-curated highlights, Frameworks as structured models.

### Wiki Section
- NOT a wiki itself — wiki.wfmlabs.org is the source of truth
- Beacon posts highlights/summaries with "why this matters" + discussion
- Each wiki entry links back to full article on wiki.wfmlabs.org
- Members discuss, challenge, contribute perspective
- Validated insights cycle back to wiki via Beacon

### Frameworks Section
- New Payload collection: `frameworks`
- Initial seed: Value-Based Planning Model, WFM Maturity Model
- Detail page: overview → components → application guidance → discussion
- Cross-references to Tools that implement the framework

### Deliverables
| Item | Priority |
|------|----------|
| Create Frameworks collection | High |
| Wiki browse page (Beacon-curated model) | High |
| Wiki detail page (link-back + discussion) | High |
| Frameworks browse page | High |
| Framework detail page | High |
| Seed: Value-Based Planning Model | High |
| Seed: WFM Maturity Model | Medium |
| Scenarios browse page (real, not stub) | Medium |
| Seed topics taxonomy | Medium |

---

## Phase 2B: Beacon Agent — Read-Only (Planned)

**Goal:** Beacon posts to the Hub automatically, surfacing wiki topics.

**Spec:** `~/cloud/projects/wfmlabs-wiki/02-working/beacon-agent-spec.md`

| Item | Notes |
|------|-------|
| Create Beacon Member account with API key | type: 'agent' |
| Create Beacon Neon DB project | Activity log, engagement tracking |
| Build Cloudflare Worker (cron: 1x daily initially) | |
| Worker reads from WFMWiki Neon DB | Topics backlog, pages inventory |
| Worker generates content via Claude API | Discussion-opener format |
| Worker posts to Payload CMS API | WikiEntries or Articles |
| Manual review queue (Phase 1: draft status, Ted approves) | |
| Beacon profile page at /@beacon | |

**Design decisions:**
- Beacon posts to existing collections (wiki-entries, articles, papers) not a new "cards" collection
- Start 1x daily until 10+ members, scale to 2-3x
- Phase 1: post as draft, Ted approves → published
- Beacon's "discussion questions" become first Discussion comment (self-reply seeds conversation)

---

## Phase 2C: Beacon Engagement Loop (Planned)

**Goal:** Beacon reads comments, responds, cycles insights to wiki.

| Item | Notes |
|------|-------|
| Read comments on Beacon's posts | Query Discussions where asset author = Beacon |
| Analyze argument quality | Claude API evaluation |
| Generate conversational responses | Post as Discussion entries |
| Track engagement in beacon_engagement table | |
| Wiki feedback loop | Strong community input → wiki backlog update |
| Synthesis comments ("Based on this discussion...") | |

---

## Phase 3: Commerce Layer (Planned — June)

**Goal:** Stripe integration, tier-gated access, paid memberships.

| Item | Notes |
|------|-------|
| Install @payloadcms/plugin-stripe | |
| Create Plans collection | |
| Create Subscriptions collection | |
| Add `tier` field to Members + content collections | |
| Implement tierGate access control | |
| Build /pricing page | |
| Stripe Checkout + webhook handler | |
| Customer Portal integration | |
| Trial strategy (card required — decided) | |
| Tier names + prices (TBD) | |

**Deferred decisions:** Tier names, prices, Founding Member specifics, Builder Lab merger.

---

## Phase 4: ROC / OpenMCT + Multi-Agent (Planned — July+)

| Item | Notes |
|------|-------|
| Open MCT instance at roc.wfmlabs.com | |
| Hub Scenarios can embed Open MCT views | |
| ROC-driven Scenario creation | Anomaly → auto-create Scenario |
| SSO between Hub and ROC | |
| ROC-Bot agent | Operational, alert-oriented |
| ToolSmith agent | Builder, demo-oriented |
| Compass agent | Editorial, newsletter tie-ins |
| wfmlabs.com tool catalog pulls from Payload API | |
| Wiki cross-references Payload content | |

---

## Content Pipeline

| Content Type | Source | Volume | Status |
|-------------|--------|--------|--------|
| Tools | Deployed on Netlify | 5 seeded (10+ available) | Partial |
| Research papers | FOW-Value evidence library | 15 seeded (200+ available) | Partial |
| Wiki entries | Beacon-curated from wiki.wfmlabs.org | 0 | Phase 2A |
| Frameworks | Ted writes + TARS assists | 0 | Phase 2A |
| Articles | Ted writes exclusively for Hub | 0 | Phase 2A |
| Scenarios | Member-contributed | 0 | Phase 2A+ |
| Topics taxonomy | Appendix B (50+ topics) | 0 seeded | Pending |
