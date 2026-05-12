# Current State — WFM Labs Hub

**Last updated:** 2026-05-11
**Phase:** Build (active development, pre-deploy)
**Seed doc version:** v1.1

## What Exists

- Seed document v1.1 — source of truth
- MEMORY directory with 16 ADRs
- TARS session infrastructure (CLAUDE.md, WFMLabsHub skill)
- Full Next.js 15 + Payload CMS 3.x application (71+ source files)
- 13 collections registered: Members, Topics, Papers, Articles, Tools, WikiEntries, NewsletterIssues, Media, Discussions, Reactions, AssetVersions, AssetRelationships, AssetContributions
- Auth: NextAuth v5 (Google + GitHub OAuth + Credentials), Payload JWT, auto-provisioning
- **Two-tier Member profile** (Tier 1: industry/workforce, Tier 2: OVIX contributor with footprint grid)
- **Cross-platform auth API** for ROC/OVIX integration (verify + profile endpoints)
- Frontend: home, login, setup (two-step), settings (5 tabs), member profile, directory, plus browse/detail pages for all content types
- Components: GlobalNav, Footer, UserMenu, AuthProvider, AssetCard, DiscussionSection, etc.
- Access control: isAdmin, isAuthor, isMember, isModerator
- DB migrations (initial + all_collections, profile-redesign pending)
- Neon database connected (wfmlabs-hub project)
- R2 bucket created (credentials not populated)
- Vercel project linked
- OVIX live status widget on homepage

## What Does NOT Exist Yet

- Git repository (not initialized, no commits)
- GitHub repo (`wfmlabsorg/wfmlabs-hub`)
- Deployed preview or production
- OAuth credentials configured (Google/GitHub IDs)
- ROC/OVIX auth integration (Hub side built, ROC Worker side pending)
- ROC_API_KEY generated
- Profile redesign migration run
- Any seed content in collections

## Decisions Made

See `decisions/` for full ADRs (16 total). Recent:
- ADR-0016: Profile redesign + cross-platform auth (Payload as ecosystem identity source, two-tier profile, shared session via API)

## What's Next

1. Fix bun install (filesystem issues)
2. Run profile-redesign migration
3. Generate TypeScript types
4. Git init + first commit
5. Push to GitHub
6. Deploy to Vercel
7. Configure OAuth credentials
8. Hand off API contract to ROC/OVIX session

## Known Issues

- bun install fails with EIO errors on cloud-synced filesystem — may need local node_modules or symlink workaround
