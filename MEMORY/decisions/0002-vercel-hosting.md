# ADR 0002: Vercel for Application Hosting

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Need a hosting platform for Next.js + Payload CMS 3.x. Payload requires full Node.js runtime. WFM Labs premium tools already deploy to Netlify.

## Decision

Vercel hosts the Payload + Next.js app. Netlify continues hosting premium tools. Cloudflare Pages hosts tedlango.com. Each platform serves its appropriate use case.

## Alternatives considered

### Cloudflare Pages
Uses Workers runtime with limited Node.js compatibility. Payload 3.x requires full Node.js APIs. **Disqualified** for the main app, but continues to host agent runtimes (Workers) and tedlango.com (Pages).

### Netlify
Works for Next.js but less battle-tested for Payload 3.x. **Documented as fallback** if Vercel pricing or features become an issue.

## Consequences

### Positive
- Best Payload 3.x support (where it's most heavily tested)
- Native Next.js optimization
- Preview environments per PR
- Free Hobby tier covers initial usage

### Negative
- Another hosting provider alongside Netlify and Cloudflare Pages
- $20/month Pro tier when Hobby limits hit

## References

- Seed doc v1.1, Section 5.4
