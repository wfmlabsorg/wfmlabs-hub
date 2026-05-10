# Open Questions — WFM Labs Hub

Questions needing resolution. When resolved, write an ADR and move entry to "Resolved" section.

## Open

### Q11: Desktop-first or mobile-first design?
**Context:** Knowledge workers at desks vs. mobile checking on the go.
**Recommendation:** Desktop-first, mobile-responsive. Not a native app.
**Decide by:** Week 4 (frontend build).

### Q12: When does wfmlabs.com (Hugo) pull from Payload API?
**Context:** Tool catalog currently uses Hugo frontmatter. Eventually should pull tool metadata from Payload.
**Recommendation:** Phase 4+. Design the API contract now; bridge when ready.
**Decide by:** Phase 4 planning.

### Q13: ROC Postgres schema — shared tables or API boundary?
**Context:** ROC has its own schema (tickets, validations, OVIX). Hub has Payload schema.
**Resolution drafted:** API boundary. Payload owns content/identity. ROC owns telemetry. Communicate via API.
**Decide by:** Phase 4 planning.

## Deferred to Phase 2

### Q5: Tier names and prices?
Practitioner / Practitioner Plus are working names. Final decided when commerce ships.

### Q6: Free trial — card required?
Card required (decided). Implementation details in Phase 2.

### Q7: Builder Lab vs Hub Practitioner Plus?
Should be the same product at $49/mo. Decide when commerce layer ships.

### Q8: Annual billing default on /pricing?
Decide when pricing page ships.

### Q9: Public visibility of paper abstracts for SEO?
Recommend titles + abstracts public, full text gated. Decide when tier gating ships.

### Q10: Member directory privacy default?
Recommend opt-out (listed by default). Decide when tier gating ships.

## Resolved

### Q1: Discussion threading — flat or nested?
**Resolution:** Flat with @-mentions. Schema includes nullable `parentDiscussionId` for future one-level nesting.
**ADR:** 0011
**Date:** 2026-05-09

### Q2: Founding Member — separate tier or flag?
**Resolution:** Boolean flag `foundingMember: true` on Practitioner Plus members. Not a separate tier.
**ADR:** Part of commerce design (Phase 2)
**Date:** 2026-05-09

### Q3: Meilisearch or Postgres FTS?
**Resolution:** Postgres FTS for Phase 1. Meilisearch when content > 500 items.
**ADR:** 0009
**Date:** 2026-05-09

### Q4: Monorepo or flat?
**Resolution:** Flat for Phase 1. Extract packages when second consumer exists.
**ADR:** 0004
**Date:** 2026-05-09
