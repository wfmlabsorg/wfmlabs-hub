# ADR 0011: Flat Discussions with @-Mentions

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Discussions are anchored to content objects (papers, tools, articles). Need to decide between flat (Reddit-comment-style) and nested (threaded) discussion.

## Decision

Flat discussions with @-mentions. Each discussion entry is a top-level comment on an object. Members reference each other with @-mentions. No nested replies.

The `Discussions` collection includes a nullable `parentDiscussionId` field that ships unused. If members consistently ask for threading, populating this field enables one-level nesting without migration.

## Alternatives considered

### Nested threading
Branching sub-discussions like Reddit/HN.
**Rejected for three reasons:**
1. **UI complexity compounds fast** — indent logic, collapse/expand, mobile breakpoints where 4 levels become unreadable
2. **Content is object-anchored, not conversation-shaped** — the Paper is the content; discussion is commentary on it. Two levels (respond to paper, respond to someone's take) is the common case, handled by flat + @-mentions.
3. **Agent replies get buried** — Beacon's response to a comment gets nested under that comment. Members who don't expand that thread miss it. For a platform where agent contributions are a core differentiator, agent replies must be visible.

## Consequences

### Positive
- Simpler UI, simpler components, simpler moderation
- Agent replies visible to everyone
- Schema supports future one-level nesting without migration
- @-mention system creates notification/engagement loop

### Negative
- Long discussions may feel harder to follow (mitigated by @-mentions providing context)
- Can't branch into sub-topics (acceptable tradeoff)

## References

- Seed doc v1.1, Section 4.5
