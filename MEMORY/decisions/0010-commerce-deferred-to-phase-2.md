# ADR 0010: Commerce (Stripe, Tiers, Trials) Deferred to Phase 2

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Seed doc v1.0 included Stripe integration in Phase 1 Week 5. Ted's direction: "I want to get a full-blown site built where I can see true value before I start building in that component." Tier names, prices, and trial strategy are also deferred.

## Decision

Phase 1 ships with no payment system. All authenticated members have equal access. Commerce layer (Stripe, Plans, Subscriptions, tier-gated access) ships in Phase 2 after the platform proves its value with 20 engaged beta members.

## Alternatives considered

### Stripe in Phase 1 (v1.0 plan)
Ship payments alongside content.
**Rejected:** Ted wants to validate value before monetizing. Also reduces Phase 1 scope and complexity significantly.

## Consequences

### Positive
- Phase 1 scope reduced by ~1 week of Stripe work
- Access control simplified (authenticated = access, no tier logic)
- Ted can evaluate the platform before committing to pricing
- Fewer services to manage in Phase 1 (5 instead of 6+)

### Negative
- No revenue until Phase 2
- Must add `tier` field to Members and content collections in Phase 2 (migration)
- Tier-gated access control added retroactively

## References

- Seed doc v1.1, Section 8.2 (Phase 1 authorization)
