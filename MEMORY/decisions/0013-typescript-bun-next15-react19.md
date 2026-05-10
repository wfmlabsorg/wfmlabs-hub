# ADR 0013: TypeScript + Bun + Next.js 15 + React 19

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Need to select language, runtime, framework, and package manager. Ted's stack preferences: TypeScript over Python, Bun over npm/yarn/pnpm.

## Decision

- **Language:** TypeScript (strict mode)
- **Package manager:** Bun (NEVER npm/yarn/pnpm)
- **Framework:** Next.js 15+ with App Router
- **React:** React 19 (React Server Components)

## Consequences

### Positive
- TypeScript-native Payload integration (schema-as-code)
- Bun is fastest package manager, aligns with Ted's preferences
- Next.js 15 App Router is the standard for new React apps
- React 19 RSC reduces client JavaScript bundle

### Negative
- Bun ecosystem slightly less mature than npm for edge cases
- React 19 is newer; some third-party components may lag

## References

- Seed doc v1.1, Section 5.5
- CLAUDE.md stack preferences
