# ADR 0004: Flat Repo Structure, No Monorepo for Phase 1

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Seed doc v1.0 specified a monorepo with `packages/design-system/`, `packages/agent-sdk/`, `packages/shared/`, and Turborepo. In Phase 1, only one deployable app exists (Next.js + Payload). No second consumer needs shared packages.

## Decision

Flat repo with a single Next.js + Payload app. No `packages/` directory, no Turborepo. Extract packages when a second consumer exists (Phase 3 when agents need `agent-sdk`, Phase 4 when wfmlabs.com needs shared types).

## Alternatives considered

### Monorepo from Day 1
Set up Turborepo + packages immediately.
**Rejected:** Configuration complexity for zero benefit. Solo developer with one deployable app doesn't need workspace orchestration.

## Consequences

### Positive
- Simpler project structure
- Faster iteration in Phase 1
- No Turborepo config to maintain
- All code in one place, easy to navigate

### Negative
- Must restructure when extracting packages (Phase 3+)
- No shared type system between apps (only one app exists)

## References

- Seed doc v1.1, Section 6.2
