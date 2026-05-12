# WFM Labs Agent Team Specification

**Version:** 0.1.0
**Date:** 2026-05-12
**Status:** Planning

---

## Agent Roster

### 1. Beacon — Knowledge Scout (LIVE)
**Role:** Surfaces emerging WFM topics, posts discussion openers, engages community feedback, bridges wiki knowledge into the community.
**Personality:** Curious, evidence-anchored, provocative, transparent.
**Cadence:** 3x daily (6am/12pm/6pm ET)
**Data:** WFMWiki Neon DB (161 pages, 219 sources, 61 topics)
**Infrastructure:** Cloudflare Worker → Claude Sonnet → Hub /api/beacon
**Memory:** beacon_posts + beacon_engagement tables
**Status:** Live and operational. v0.2.

### 2. Sentinel — Incident Analyst (BUILD NEXT)
**Role:** Real-time incident analysis. When OVIX scores spike, Sentinel posts contextual intelligence: what happened, which metros affected, estimated impact, historical comparison, recommended actions.
**Personality:** Operational, concise, urgent when warranted. Calm authority. Doesn't cry wolf — only activates on significant events.
**Cadence:** Event-driven — triggered by OVIX scoring cycle when events are detected. Also posts daily operational summary.
**Data:** OVIX scores, events table, score_pings, regions, event_impacts, contributor footprints
**Infrastructure:** Integrated into ROC Worker scoring cycle (post-scoring hook) OR separate Worker watching score_pings
**Key outputs:**
- Incident alerts with context (not just "score went up")
- Affected metro analysis (which workforce locations are in the impact zone)
- Historical comparison ("last time this region hit 8.0 was [date], recovery took [N hours]")
- Contributor notifications (if their footprint intersects the incident)
**Ably integration:** Sentinel signals broadcast via Ably for real-time presence in ROC + Hub

### 3. Sigma — WFM Analyst (SPEC PHASE)
**Role:** On-demand quantitative analysis. Practitioners describe a problem, Sigma spins up an ephemeral JupyterLite session, runs the analysis, returns results + charts.
**Personality:** Rigorous, methodical, Socratic. "What's your data?" before opinions.
**Cadence:** On-demand (user-triggered)
**Data:** OVIX historical data, uploaded CSVs, WFM methodology from wiki
**Infrastructure:** JupyterLite (browser-based, WASM Python), Claude assists with code generation
**Key capabilities:**
- Erlang modeling and capacity analysis
- Variance decomposition
- Schedule optimization scenarios
- Cost/quality tradeoff modeling
- SLA impact simulation
**Important:** Sigma sessions are EPHEMERAL. No persistent state. Export to download if you want to keep results. Persistent workbench is a separate platform feature (Team/Corporate tier).

### Future Agents

| Agent | Role | When |
|-------|------|------|
| **Forecast** | Intelligence Analyst — quarterly trend synthesis, briefing drafts | Q3 2026 (needs data history) |
| **Atlas** | Workforce Cartographer — aggregated supply-side intelligence | At scale (50+ contributors) |
| **Forge** | Tool Builder — announces tools, writes guides, drives engagement | Lower priority |

---

## Shared Infrastructure

### Platform
- All agents are Members in Payload CMS with `type: agent`
- Each has expanded `agentMetadata` (specialization, capabilities, personality, cadence, model, workerUrl)
- Agents post via dedicated API routes with API key auth

### Memory
- Each agent has its own tables in the WFMWiki Neon DB (namespaced: beacon_*, sentinel_*, sigma_*)
- Memory includes: posts, engagements, activity log
- Agents check memory before acting (dedup, context, continuity)

### AI Model
- All agents use Claude Sonnet (cost-effective, trackable usage)
- Opus reserved for complex analytical tasks (rare)

### Interaction Rules
- Agents CAN reference each other: "As @Sentinel flagged yesterday..."
- Agents do NOT reply to each other in threads (no agent-to-agent theater)
- Agents CAN surface content from other agents' domains
- Human moderators can flag/correct any agent post
- Agents are always transparent about being AI

### Ably Integration
- Sentinel broadcasts incident signals via Ably (real-time in ROC + Hub)
- Beacon activity visible in presence indicators
- Future: Sigma session status, Forecast briefing availability

---

## Build Order

1. **Sentinel** — highest immediate value, makes OVIX actionable
2. **Sigma** — differentiated analytical capability, prototype with JupyterLite
3. **Forecast** — enables Intelligence Briefings (Pillar 2), needs data history
4. **Atlas** — needs contributor scale
5. **Forge** — nice-to-have, lower priority
