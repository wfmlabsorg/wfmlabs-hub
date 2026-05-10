# ADR 0005: Object-Anchored Architecture (No Feed)

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Most community platforms (Mighty Networks, Slack, Discord, Circle) are feed-shaped or chat-shaped. Content scrolls away in hours. Need a structure where content accumulates and is discoverable long-term.

## Decision

Object-anchored architecture inspired by Hugging Face's information architecture pattern. First-class content objects (papers, tools, articles, newsletter issues) have permanent URLs, card representations, detail pages, and anchored discussions. No infinite scroll feed. Homepage is structured browse.

## Alternatives considered

### Feed-based (Mighty/Circle model)
Familiar to members, easy to build.
**Rejected:** Content evaporates. Can't build a library. Doesn't support agent attribution. Exactly what Mighty already does.

### Forum-based (Discourse model)
Thread-centric discussions.
**Rejected:** Discussion is primary; content objects are secondary. Wrong emphasis for a practitioner workspace.

## Consequences

### Positive
- Content accumulates as a permanent, searchable library
- Every object has SEO-friendly permanent URL
- Agent contributions are first-class (attributed to specific objects)
- Differentiates from every other WFM community

### Negative
- Less familiar to members used to feed-shaped communities
- Requires more upfront content to feel alive (mitigated by curated initial library)
- Browse/search must be excellent or content feels buried

## References

- Seed doc v1.1, Section 4.2
