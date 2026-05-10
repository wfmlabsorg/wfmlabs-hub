# ADR 0002: Netlify for Application Hosting

**Date:** 2026-05-10
**Status:** Accepted (supersedes original ADR-0002 "Vercel for Application Hosting")
**Authors:** Ted Lango, TARS

## Context

Original ADR-0002 chose Vercel because Payload 3.x is most heavily tested there. However, Ted already runs 118 sites on Netlify including all WFM Labs premium tools. Adding Vercel means a new vendor account, new billing, new workflow — for marginal optimization-tier differences, not capability differences.

## Decision

Netlify hosts the Payload + Next.js app. This consolidates all WFM Labs hosting on a single platform. Netlify Functions provide the full Node.js runtime Payload requires. Next.js deploys via `@netlify/plugin-nextjs`.

## Alternatives considered

### Vercel (original choice)
Best Payload support, native Next.js optimization.
**Reconsidered:** The advantages are marginal. Payload works on Netlify. Adding a new vendor for slight cold-start improvements isn't justified when Ted already has deep Netlify infrastructure.

### Cloudflare Pages
Workers runtime with limited Node.js compatibility.
**Rejected:** Payload 3.x requires full Node.js APIs. Disqualified for the main app.

## Consequences

### Positive
- One fewer vendor to manage
- Existing Netlify auth token, billing, DNS config
- Operational consistency with 118 other sites
- Same auto-deploy-on-push, preview-per-PR workflow
- Known deployment pipeline (Ted and TARS both familiar)

### Negative
- Slightly less optimized for Next.js than Vercel (marginal)
- Neon database branching integration not built-in (can configure manually)
- If Netlify's Next.js adapter has issues, Vercel is the escape hatch

## References

- Seed doc v1.1, Section 5 (updated)
- Original ADR-0002 superseded
