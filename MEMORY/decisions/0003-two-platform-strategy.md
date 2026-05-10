# ADR 0003: Two-Platform Strategy (Mighty Free, Hub Paid)

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

WFM Labs has an existing free community on Mighty Networks (community.wfmlabs.org). Need to determine whether the Hub replaces Mighty or complements it.

## Decision

Two-platform strategy. Mighty Networks stays as the free top-of-funnel. The Hub at community.wfmlabs.com is the paid tier with structurally different value (object-anchored, agent-native, accumulating library vs. ephemeral feed).

## Alternatives considered

### Replace Mighty entirely
Migrate all free members to Hub free tier.
**Rejected:** Mighty is established, has ~1,200 members, and costs $99/mo on legacy plan. The Hub is a different category of product, not a Mighty replacement.

### Build on top of Mighty
Use Mighty APIs to extend functionality.
**Rejected:** Mighty doesn't support author attribution for agents, has limited API access, and doesn't support object-anchored architecture.

## Consequences

### Positive
- No disruption to existing free community
- Clear value differentiation justifies separate pricing
- Mighty serves as natural funnel to paid Hub
- If Mighty deteriorates, Hub is ready to absorb members

### Negative
- Two platforms to maintain awareness of
- Members may be confused about which community to use (mitigated by clear upgrade messaging)

## References

- Seed doc v1.1, Section 2.2
