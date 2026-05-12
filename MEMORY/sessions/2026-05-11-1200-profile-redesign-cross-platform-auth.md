# Session: Profile Redesign + Cross-Platform Auth

Date: 2026-05-11 12:00
Phase: Build (Week 1+)

## Goal
Redesign the Members profile with two tiers (basic + OVIX contributor) and build cross-platform auth endpoints so the ROC/OVIX dashboard can share identity with community.wfmlabs.com.

## What we did
- Created taxonomy constants file (`src/lib/constants/taxonomies.ts`): 14 industries, 5 workforce types, sourcing types, customer geo scopes, US regions, US states
- Redesigned Members collection with:
  - Tier 1: industry (select), workforceTypes (multi-select)
  - Tier 2: ovixProfile group with isOvixContributor, isBpo, clientIndustries, workforceFootprint (array), customerGeography (group with scope + conditional fields)
  - Cross-platform: rocUserId (indexed, readOnly)
  - Visibility: added showIndustry, showOvixData toggles
- Updated `/api/members/setup` route to accept and validate all new fields
- Created `POST /api/auth/verify` — cross-platform JWT verification for ROC Worker
- Created `GET /api/members/profile/[id]` — full profile read with dual auth (API key + JWT) and dual lookup (Payload ID + rocUserId)
- Updated `next.config.ts` with CORS headers for ROC origin
- Rewrote setup page with two-step flow: Step 1 (basic profile) → Step 2 (OVIX contributor opt-in with footprint grid and customer geography)
- Rewrote settings page with new OVIX Contributor tab, industry/workforce on Profile tab, updated Privacy tab
- Updated member profile view with industry badges, workforce type pills, OVIX Contributor badge, and full OVIX data section (workforce footprint table + customer geography)
- Updated members directory with industry filter chips, OVIX Contributors toggle, workforce type pills on member cards, OVIX badge
- Wrote ADR-0016
- Added ROC_API_KEY and ROC_ORIGIN to .env and .env.example

## What's pending
- Database migration (bun install had filesystem issues — needs retry)
- TypeScript type regeneration after migration
- ROC session handoff: schema spec + API contract for OVIX Worker integration
- Testing the full flow end-to-end
- Git init + first commit

## What we learned
- R2/cloud-synced filesystem causes EIO errors with node_modules — may need to install locally rather than in cloud-synced directory
- Payload array fields create proper join tables in Postgres, not JSONB — good for structured workforce footprint data
- Server components can't use onChange on selects; directory filters use link-based category chips instead

## Files created
- `src/lib/constants/taxonomies.ts`
- `src/app/api/auth/verify/route.ts`
- `src/app/api/members/profile/[id]/route.ts`
- `MEMORY/decisions/0016-profile-redesign-cross-platform-auth.md`
- `MEMORY/sessions/2026-05-11-1200-profile-redesign-cross-platform-auth.md`

## Files modified
- `src/collections/Members.ts` — major redesign
- `src/app/api/members/setup/route.ts` — new field handling
- `src/app/(frontend)/me/setup/page.tsx` — two-step flow
- `src/app/(frontend)/me/settings/page.tsx` — OVIX tab, industry field
- `src/app/(frontend)/member/[username]/page.tsx` — industry badges, OVIX section
- `src/app/(frontend)/members/page.tsx` — industry filters, OVIX toggle
- `next.config.ts` — CORS headers
- `.env` / `.env.example` — ROC_API_KEY, ROC_ORIGIN
