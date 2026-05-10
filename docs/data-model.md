# Data Model — WFM Labs Hub

**Source of truth:** `wfmlabs-platform-seed-v1.1.md`, Section 7
**Updated when:** Collections are created or modified

---

## Collection Map

```
Members ◄──── addedBy/author/postedBy ────► Papers
   │                                          │
   │                                     Articles
   │                                          │
   │                                       Tools
   │                                          │
   │                                  NewsletterIssues
   │                                          │
   ├──── author ──────────────────► Discussions
   │                                     │
   ├──── member ──────────────────► Reactions
   │                                     │
   ├──── recipient ───────────────► Notifications
   │
   ├──── actor ───────────────────► AuditLog
   │
   └──── expertise ───────────────► Topics
                                      │
                              ◄── topics[] ──── Papers, Articles, etc.
```

## Collection Status

| Collection | Schema Defined | Built | Content Loaded | Tests |
|-----------|---------------|-------|----------------|-------|
| Members | v1.1 seed doc | No | — | — |
| Topics | v1.1 seed doc | No | — | — |
| Media | Payload default | No | — | — |
| Papers | v1.1 seed doc | No | — | — |
| Articles | v1.1 seed doc | No | — | — |
| Tools | v1.1 seed doc | No | — | — |
| NewsletterIssues | v1.1 seed doc | No | — | — |
| Discussions | v1.1 seed doc | No | — | — |
| Reactions | v1.1 seed doc | No | — | — |
| Notifications | v1.1 seed doc | No | — | — |
| AuditLog | v1.1 seed doc | No | — | — |

## Phase 2 Collections (designed, not built)

| Collection | Notes |
|-----------|-------|
| Plans | Stripe product/price sync |
| Subscriptions | Stripe subscription records |
| Jobs | Job postings |
| Scenarios | Member-posted WFM situations |

## Phase 3 Collections

| Collection | Notes |
|-----------|-------|
| AgentRuns | Agent invocation logging with cost telemetry |

## Access Control Functions

| Function | Purpose | Status |
|----------|---------|--------|
| `isAdmin` | `user.type === 'admin'` | Designed |
| `isMember` | `Boolean(user)` | Designed |
| `isAuthor(field)` | `user.id === doc[field] \|\| isAdmin` | Designed |
| `tierGate(minTier)` | Phase 2 — tier-based access | Designed, not built |
| `isPaidMember` | Phase 2 — paid tier check | Designed, not built |

## Key Design Patterns

### Agent-as-Member
Agents are Members with `type='agent'`. Same identity system, same author attribution. `agentMetadata` group holds agent-specific fields (tagline, role, MCP endpoint). Designed Day 1, used Phase 3.

### Flat Discussions
`parentDiscussionId` is nullable and ships unused. All discussions are top-level comments on parent objects. @-mentions via `mentions[]` array. Escape hatch for one-level nesting preserved in schema.

### Content Object Pattern
Every content collection (Papers, Articles, Tools, NewsletterIssues) follows:
- `slug` (unique, auto-generated from title)
- `addedBy` / `author` (relationship to Members)
- `topics[]` (relationship to Topics)
- `discussionCount` / `reactionCount` (denormalized counters)
- Consistent access control pattern
