# ADR-0016: Profile Redesign + Cross-Platform Auth

**Date:** 2026-05-11
**Status:** Accepted
**Deciders:** Ted Lango

## Context

The WFM Labs ecosystem has two platforms that need unified identity: community.wfmlabs.com (Payload CMS Hub) and the ROC/OVIX operational dashboard (OpenMCT + Cloudflare Worker). Each currently manages its own users independently. The Hub profile is basic (name, title, company, bio). The OVIX platform needs workforce and geographic data to correlate incidents with member operations.

## Decision

### 1. Payload as Authoritative Identity Source
The Members collection in Payload CMS becomes the single source of truth for user identity across both platforms. ROC/OVIX will validate Hub-issued tokens rather than managing its own user registration.

### 2. Two-Tier Profile Design
- **Tier 1 (Basic):** Display name, username, title, industry (replaces company as primary field), workforce types, bio, location, expertise topics
- **Tier 2 (OVIX Contributor — optional):** Workforce footprint grid (location/headcount/sourcing/type per row), customer geography (scope + conditional detail), BPO flag with client industries

### 3. Cross-Platform Auth via Shared API
- `POST /api/auth/verify` — ROC Worker validates Hub JWT tokens
- `GET /api/members/profile/[id]` — Full profile read for cross-system consumption
- Dual auth: API key for server-to-server, JWT for browser sessions
- `rocUserId` field on Members maps to ROC's existing user_id

### 4. Industry Taxonomy as Inline Constants
Not a separate collection. Small, stable list (14 options) defined in `src/lib/constants/taxonomies.ts`. Shared between collection config and frontend.

### 5. Company Field Demoted
Kept in schema for backward compatibility but removed from primary UI surfaces. Replaced by Industry as the primary professional identifier. Members are sensitive about company names; industry is safer for community profiles.

## Consequences

- ROC Worker will need modification to redirect auth to Hub and accept Hub JWTs
- Existing ROC users need migration: match by email → set `rocUserId` on Hub member
- ROC's `openmct_objects`, `chat_messages`, `signals` tables continue using ROC-local user_id; mapping table bridges the gap
- OVIX agents can now query member footprints for incident correlation
- Profile setup is a two-step flow; users can skip OVIX contribution
- No breaking changes to existing members — all new fields are nullable/optional

## Related
- ADR-0001: Payload as ecosystem-wide content backbone
- ADR-0012: Agents as Members with type field
