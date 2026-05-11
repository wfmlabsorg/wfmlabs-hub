# Current State — WFM Labs Hub

**Last updated:** 2026-05-10
**Phase:** 1B/1C (Frontend + cross-cutting infrastructure)
**Version:** v0.3.0
**Seed doc:** v1.1

## Live Deployment

- **URL:** https://wfmlabs-hub-local.vercel.app
- **Admin:** https://wfmlabs-hub-local.vercel.app/admin
- **Admin user:** ted@wfmlabs.com
- **Hosting:** Vercel (Hobby tier)
- **Database:** Neon Postgres (dedicated project)
- **Storage:** Cloudflare R2 (wfmlabs-media bucket)

## What Exists

### Infrastructure
- Git repo: wfmlabsorg/wfmlabs-hub (public)
- Payload CMS 3.84.1 + Next.js 15.5.18
- 14 collections (7 asset types + 5 cross-cutting + Members + Media)
- WLAA asset architecture with shared base fields
- TARS session infrastructure (CLAUDE.md, MEMORY, ADRs, WFMLabsHub skill)

### Frontend
- HF-inspired design system (yellow accent, dark/light mode)
- GlobalNav: Tools, Research, Wiki, Frameworks, Scenarios, Members
- Homepage with live stats + content grid
- HF Spaces-style gradient cards
- Tool browse + detail pages (with embedded iframe)
- Research browse + detail pages
- Discussion + Reactions components (cross-cutting, wired into Tools + Research)
- Wiki, Frameworks, Scenarios browse pages (stubbed)
- Member profiles, About page

### Content
- 5 tools seeded (Monte Carlo, Erlang Suite, Variance Analyzer, Value-Based Planning, ABA Curve)
- 15 research papers seeded from FOW-Value evidence library
- 0 wiki entries, 0 frameworks, 0 scenarios, 0 articles

### Dev Environment
- Cloud dir (git): ~/cloud/projects/wfmlabs-hub/
- Local dev dir (node_modules): ~/projects/wfmlabs-hub-local/
- NOTE: R2 sync deletes .git directory periodically — clone from GitHub to restore

## What's Next (see docs/ROADMAP.md)

**Immediate (Phase 1B/1C completion):**
1. Build Wiki browse + detail pages (Beacon-curated model)
2. Create Frameworks collection + browse/detail pages
3. Seed Frameworks (Value-Based Planning, Maturity Model)
4. Seed Topics taxonomy
5. Wire Discussion + Reactions into Research detail pages
6. Add remaining 5+ tools

**Next phase (2A/2B):**
1. Beacon agent — read-only posting from wiki pipeline
2. Scenarios collection + browse/detail
3. More content seeding

## Known Issues

- R2 sync periodically removes .git from cloud dir — use /tmp clone workflow for commits
- Vercel API auth (Bearer token) returns 500 — cookie auth + overrideAccess works fine
- No CI/CD pipeline yet (GitHub Actions not configured)
- No search functionality implemented yet (Postgres FTS ready but no UI)

## Planning Documents

- **Roadmap:** `docs/ROADMAP.md` — phased plan with status tracking
- **Release notes:** `docs/RELEASE-NOTES.md` — what shipped per version
- **Beacon spec:** `~/cloud/projects/wfmlabs-wiki/02-working/beacon-agent-spec.md`
- **Asset architecture:** `wfmlabs-asset-architecture-v1.md` (WLAA)
- **Seed doc:** `wfmlabs-platform-seed-v1.1.md`
