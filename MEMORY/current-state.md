# Current State — WFM Labs Hub

**Last updated:** 2026-05-12
**Phase:** Build (deployed, pre-launch)
**Seed doc version:** v1.1

## What Exists

- Seed document v1.1 — source of truth
- MEMORY directory with 16 ADRs
- TARS session infrastructure (CLAUDE.md, WFMLabsHub skill)
- Full Next.js 15 + Payload CMS 3.x application (130+ source files)
- 13 collections registered: Members, Topics, Papers, Articles, Tools, WikiEntries, NewsletterIssues, Media, Discussions, Reactions, AssetVersions, AssetRelationships, AssetContributions
- Auth: NextAuth v5 (Google + GitHub OAuth + Credentials), Payload JWT, auto-provisioning
- **Two-tier Member profile** (Tier 1: industry/workforce, Tier 2: OVIX contributor with footprint grid + EU geo scope)
- **Cross-platform auth API** for ROC/OVIX integration (verify + profile endpoints)
- Frontend: home, login, setup (two-step), settings (5 tabs), member profile, directory, plus browse/detail pages for all content types
- Components: GlobalNav, Footer, UserMenu, AuthProvider, AssetCard, DiscussionSection, etc.
- Access control: isAdmin, isAuthor, isMember, isModerator
- Generated TypeScript types (1609 lines)
- **GitHub repo:** `wfmlabsorg/wfmlabs-hub` (33 commits)
- **Local clone:** `~/projects/wfmlabs-hub/` (bun install works here)
- **Neon database** connected (wfmlabs-hub project, schema synced via dev mode)
- **Vercel production:** `community.wfmlabs.com` — deployed and serving
- **OAuth configured:** Google + GitHub credentials set as Vercel env vars
- 9 Vercel env vars: PAYLOAD_SECRET, DATABASE_URI, NEXT_PUBLIC_SERVER_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_SECRET, AUTH_URL
- R2 bucket created (credentials not populated)
- OVIX live status widget on homepage

## What Does NOT Exist Yet

- End-to-end OAuth login tested
- ROC/OVIX auth integration (Hub side built, ROC Worker side pending)
- ROC_API_KEY generated
- R2 storage credentials (for media uploads)
- Resend API key (for emails)
- Any seed content in collections
- Vercel GitHub App on wfmlabsorg org (auto-deploys not connected)
- ROC/OVIX migration into Hub (planning phase)

## Decisions Made

See `decisions/` for full ADRs (16 total). Recent:
- ADR-0016: Profile redesign + cross-platform auth
- Work from local clone, not cloud dir (R2 can't handle node_modules)
- Cross-platform session via shared API (confirmed by Ted)
- No company name in profiles — industry taxonomy replaces it
- EU added to customer geography scopes

## What's Next

1. Test OAuth login flow end-to-end
2. Plan ROC/OVIX migration into Hub (Ted wants to integrate ROC into Vercel/Payload stack)
3. Generate ROC_API_KEY for cross-platform auth
4. Hand off API contract to ROC session
5. R2 + Resend credentials
6. Seed content for beta launch

## Known Issues

- Cloud dir (`~/cloud/projects/wfmlabs-hub/`) has corrupted working tree from aborted rebase — use local clone at `~/projects/wfmlabs-hub/` instead
- R2-synced filesystem strips execute permissions on native binaries — never install node_modules in cloud dir
