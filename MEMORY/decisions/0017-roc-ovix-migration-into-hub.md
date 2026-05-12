# ADR-0017: ROC/OVIX Migration into Hub

**Date:** 2026-05-12
**Status:** Accepted
**Deciders:** Ted Lango

## Context

The ROC (Resource Optimization Center) is a proven operational dashboard built on NASA OpenMCT + Cloudflare Workers + Neon Postgres. It runs independently with its own auth, 28 ingest feeds, OVIX scoring engine, Cesium globe, and Ably real-time. Ted wants to integrate it into the WFM Labs Hub so the community experiences ROC as a first-class feature.

## Decision

### 1. Two Databases, One Identity
Hub Neon (CMS/identity) and ROC Neon (operational/time-series) stay separate. Cross-reference via `rocUserId`. Hub is the authoritative identity source (per ADR-0016).

### 2. OpenMCT as Integrated Extension (NOT iframe)
Move OpenMCT assets to Vercel. ROC opens as its own command center at `roc.wfmlabs.com`, tightly coupled with Hub auth. Same domain = shared cookies. Keep `roc-beta.wfmlabs.com` as testing backup.

### 3. Ingest Pipelines Stay on Cloudflare
The 28 feed functions and OVIX scoring engine remain as Cloudflare Workers. They're battle-tested and the 5-min cron architecture works. Only change: auth bridge to accept Hub JWTs.

### 4. Ably Extends to Hub
Ably scope extends beyond ROC to power Hub-wide real-time presence, chat, and notifications. ROC may retain OpenMCT-specific notifications, but Ably anchors at the Hub level.

### 5. Signals Elevate to Hub
Signal feed (20K+ rows) moves from ROC-only to a Hub Payload collection visible to the entire community. Agents write signals via API, members see them on homepage.

### 6. Chat → Hub Discussions
ROC chat (unused, 0 rows) replaced by Hub's existing Discussions system. Real-time chat deferred; async discussions for now.

## Consequences

- ROC Worker needs auth bridge modification (accept Hub JWTs alongside legacy tokens)
- OpenMCT assets (~5MB vendored JS) added to Hub repo
- Hub gets new collections (Signals) and API routes (OVIX proxy, signals ingest)
- Ably client-side integration needed in Hub frontend
- Globe standalone page deferred to Phase 2

## Build Order
1. Auth Bridge (Hub → ROC)
2. OpenMCT asset migration + integrated serving
3. Signals collection + feed
4. Chat → Discussions (no-op, 0 rows)
5. OVIX dashboard pages in Hub
6. Domain consolidation
