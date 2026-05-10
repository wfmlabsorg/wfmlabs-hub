# ADR 0001: Payload CMS as Ecosystem-Wide Content Backbone

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

WFM Labs has multiple properties (Hub, tool catalog, wiki, newsletter, ROC) that all need content management. Building Payload as a single-site CMS for community.wfmlabs.com would require rebuilding when other frontends need content APIs.

## Decision

Payload CMS 3.x serves as the headless content and identity backbone for the entire WFM Labs ecosystem. Every property reads from and writes to Payload's auto-generated REST + GraphQL APIs. The Hub frontend is the primary consumer, but the API is designed to support multiple frontends.

## Alternatives considered

### Option A: Payload as single-site CMS
Build Payload tightly coupled to the Hub frontend only.
**Rejected:** Would require refactoring when wfmlabs.com, ROC, or agents need content APIs.

### Option B: Strapi
Node.js CMS with similar capabilities.
**Rejected:** Separate deployment from Next.js, less TypeScript-native. Documented as migration path if Payload becomes problematic.

### Option C: Sanity
SaaS CMS with structured content.
**Rejected:** Vendor lock-in, proprietary schema format, ownership concerns.

## Consequences

### Positive
- Single source of truth for all content and identity across properties
- Auto-generated APIs immediately usable by agents, tool catalog, ROC
- Schema-as-code in TypeScript means TARS can edit collections fluently
- MIT licensed, no vendor lock-in

### Negative
- API design must consider multiple consumers from Day 1
- Payload 3.x is relatively new; production edge cases may surface
- Single point of failure if Payload has issues (mitigated by Strapi escape hatch)

## References

- Seed doc v1.1, Section 2.5 (ecosystem diagram)
- Seed doc v1.1, Section 5.3 (why Payload)
