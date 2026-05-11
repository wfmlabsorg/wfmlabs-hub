# WFM Labs Hub — Release Notes

---

## v0.3.0 — Research Section + Cross-Cutting Infrastructure (2026-05-10)

### New Features
- **Research section** with 15 curated papers from FOW-Value evidence library
  - Papers span: queueing theory, AI in operations, workforce economics, value model, agent experience
  - Each paper has curator summary, "why it matters", and caveats
  - Browse page with category filter chips (Queueing Theory, AI in Operations, etc.)
  - Detail page with source link, PDF download, authors, reaction bar, discussion section

- **Discussion system** (cross-cutting — works on any asset type)
  - Server-rendered comment threads anchored to any asset
  - GitHub-style comment layout with avatar, timestamp, rich text
  - Comment form with auth gating ("Log in to join the discussion")
  - POST /api/discussions endpoint with text → Lexical rich text conversion

- **Reaction system** (cross-cutting)
  - 4 emoji toggles: Like, Insightful, Practical, Question
  - Optimistic UI updates
  - POST /api/reactions toggle endpoint

### Changes
- All browse pages now `force-dynamic` (no stale static renders)
- Papers collection read access set to public

---

## v0.2.0 — HF-Inspired Frontend + Tool Detail Pages (2026-05-10)

### New Features
- **Hugging Face-inspired design system**
  - Yellow (#FFD21E) accent, blue links, dark blue-black dark mode
  - CSS custom properties for full theming
  - Card, button, badge, topic pill styles

- **HF Spaces-style asset cards**
  - Gradient header bands (color-coded by category)
  - Semi-transparent pill badges on gradient
  - Heart count, contributor avatar, time ago footer

- **Tool detail pages** with embedded iframe
  - Live calculator embedded (600px iframe)
  - "Launch in new tab" toolbar
  - Methodology/About/Discussion tabs
  - Sidebar with topics, stats, contributors

- **5 tools seeded**: Monte Carlo, Erlang Suite, Variance Analyzer, Value-Based Planning, ABA Curve

- **Full nav**: Tools, Research, Wiki, Frameworks, Scenarios, Members
- **Browse pages** for all sections (Wiki, Frameworks, Scenarios stubbed as "Coming soon")
- **Member profiles** at /member/[username]
- **About page**

---

## v0.1.0 — Platform Foundation (2026-05-09 → 2026-05-10)

### Infrastructure
- Payload CMS 3.84.1 + Next.js 15.5.18 deployed on Vercel
- Neon Postgres (dedicated project)
- Cloudflare R2 (wfmlabs-media bucket)
- GitHub repo: wfmlabsorg/wfmlabs-hub (public)

### Collections (14 total)
- **Identity:** Members (with auth), Topics, Media
- **Asset types:** Papers, Articles, Tools, NewsletterIssues, WikiEntries
- **Cross-cutting:** Discussions, AssetVersions, AssetRelationships, AssetContributions, Reactions

### Architecture
- WLAA (WFM Labs Asset Architecture) implemented
- Shared base asset fields via `_baseAssetFields.ts`
- Polymorphic cross-cutting collections
- Access control: isAdmin, isMember, isAuthor

### TARS Infrastructure
- 15 Architecture Decision Records
- Session protocol (CLAUDE.md, MEMORY system)
- WFMLabsHub skill for session continuity

### Key Decisions
- Vercel over Netlify (Payload server actions incompatibility)
- Flat repo (no monorepo until Phase 3+)
- Commerce deferred to Phase 3
- Postgres FTS over Meilisearch
- Flat discussions with @-mentions
- Content: original + curated over migration
