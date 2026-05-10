# Architecture Overview — WFM Labs Hub

**Source of truth:** `wfmlabs-platform-seed-v1.1.md`
**This document:** Distilled overview for quick reference. Read the seed doc for full rationale.

---

## System Architecture

```
                    ┌────────────────────────────┐
                    │    Payload CMS (Neon PG)    │
                    │    Netlify deployment         │
                    │                              │
                    │  Members / Identity           │
                    │  Papers / Articles / Tools    │
                    │  Newsletter Issues             │
                    │  Discussions / Topics           │
                    │  Media (R2)                     │
                    └──────────┬─────────────────────┘
                               │ REST + GraphQL API
              ┌────────────────┼──────────────────────┐
              │                │                      │
    ┌─────────▼────────┐ ┌────▼──────────┐  ┌────────▼────────┐
    │  Hub Frontend    │ │ wfmlabs.com   │  │ ROC / OpenMCT   │
    │  community.      │ │ Tool catalog  │  │ roc.wfmlabs.com │
    │  wfmlabs.com     │ │ (future)      │  │ (Phase 4)       │
    │  (Next.js SSR)   │ │               │  │                 │
    └──────────────────┘ └───────────────┘  └─────────────────┘
```

**Core principle:** Payload owns content and identity. Everything else is a frontend or integration.

## Tech Stack (Phase 1)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| CMS | Payload CMS 3.x |
| Database | Neon Postgres (serverless) |
| Storage | Cloudflare R2 |
| Email | Resend + React Email |
| Hosting | Netlify |
| Search | Postgres full-text search |
| Styling | Tailwind v4 + shadcn/ui |
| Package manager | Bun |
| CI/CD | GitHub Actions + Netlify auto-deploy |

## Collections (Phase 1)

| Collection | Purpose | Week |
|-----------|---------|------|
| Members | Identity (human + agent types) | 2 |
| Topics | Content taxonomy | 2 |
| Media | File uploads (R2) | 2 |
| Papers | Research library | 3 |
| Articles | Long-form content | 3 |
| Tools | Calculator/tool metadata | 3 |
| NewsletterIssues | Compass archive | 3 |
| Discussions | Flat comments on objects | 5 |
| Reactions | Likes, bookmarks | 5 |
| Notifications | In-app notification queue | 5 |
| AuditLog | Append-only action log | 6 |

## Page Templates

1. **Card** — list items across all object types
2. **Detail** — single object with discussion below
3. **Browse** — faceted index with search
4. **Profile** — member/agent profile with tabs
5. **Org** — homepage and topic pages

## Access Control (Phase 1)

Simple: authenticated = full access. No tier gating until Phase 2.

| Role | Read | Create | Update own | Admin |
|------|------|--------|------------|-------|
| Unauthenticated | Public pages only | No | No | No |
| Member | All content | Discussions, reactions | Yes | No |
| Admin (Ted) | All | All | All | Yes |

## Phasing

| Phase | Focus | Timeline |
|-------|-------|----------|
| 1 | Platform foundation (content + members + discussions) | Weeks 1-6 |
| 2 | Commerce (Stripe, tiers) + content expansion (Jobs, Scenarios) | Weeks 7-10 |
| 3 | Beacon agent (first AI agent) | Weeks 10-14 |
| 4 | ROC/OpenMCT, multi-agent, ecosystem integration | Weeks 14+ |

## Key Decisions

See `MEMORY/decisions/` for full ADRs. Highlights:
- **ADR-0001:** Payload is ecosystem-wide backbone, not single-site CMS
- **ADR-0004:** Flat repo, no monorepo until Phase 3+
- **ADR-0009:** Postgres FTS, not Meilisearch, until content > 500
- **ADR-0010:** No commerce until Phase 2
- **ADR-0011:** Flat discussions, not nested
- **ADR-0012:** Agents are Members with `type='agent'`
