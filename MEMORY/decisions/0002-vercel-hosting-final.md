# ADR 0002: Vercel for Application Hosting (Final)

**Date:** 2026-05-10
**Status:** Accepted (supersedes both previous ADR-0002 variants)
**Authors:** Ted Lango, TARS

## Context

This decision went through three iterations:
1. **v1.0:** Chose Vercel because Payload team tests there
2. **v1.1:** Switched to Netlify to consolidate with 118 existing sites
3. **v1.2 (this):** Back to Vercel after discovering Netlify's serverless function runtime doesn't handle Payload's server actions correctly

The Netlify attempt revealed that while Payload's REST API worked fine on Netlify (DB connected, auth enforced), the admin panel's React hydration failed silently in Netlify's function runtime. The admin HTML rendered server-side correctly but client-side JavaScript couldn't execute server actions through Netlify's adapter.

Note: The initial "blank screen" on both platforms was actually caused by an empty `importMap.js` file (a scaffolding error). But Netlify had an additional real issue with server actions that would have surfaced regardless.

## Decision

Vercel hosts the Payload CMS + Next.js app. Netlify continues hosting WFM Labs premium tools. This is the one app that needs Vercel's native Next.js runtime.

## Alternatives considered

### Netlify (attempted, failed)
118 existing sites, operational consistency.
**Failed:** Netlify's serverless function runtime doesn't handle Payload 3.x server actions. Admin panel rendered blank. REST API worked but admin UI did not hydrate.

### Self-hosted (Hetzner/Coolify)
Full control, no serverless issues.
**Deferred:** More ops overhead for solo operator. Viable escape hatch if Vercel pricing becomes an issue.

## Consequences

### Positive
- Payload admin works correctly (verified)
- Native Next.js runtime (Vercel built Next.js)
- Free Hobby tier covers initial usage
- Auto-deploy from GitHub

### Negative
- Second hosting vendor alongside Netlify
- Must manage Vercel account and billing separately

## Learnings

1. **Test the admin UI, not just the API.** The REST API working doesn't mean the admin panel works — they use different rendering paths.
2. **Payload's `importMap.js` must be generated, not hand-written.** Run `payload generate:importmap` after any collection change.
3. **Server actions compatibility varies by platform.** Vercel's runtime handles `'use server'` directives natively; Netlify's adapter doesn't fully support them for Payload's use case.

## References

- Seed doc v1.1, Section 5
- MEMORY/learnings/2026-05-10-importmap-and-hosting.md
