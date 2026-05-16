# WFM Labs Membership Strategy

**Status:** Strategy in development. Not for external distribution.
**Last updated:** 2026-05-13
**Stripe integration target:** Q4 2026

---

## 1. Platform Vision

WFM Labs is pivoting from a content/certification/training community into a **workforce intelligence community**. Three operational layers:

| Layer | Function | Mechanism |
|-------|----------|-----------|
| **Signal** | Automated ingestion of external data | 28+ feeds, 5-15 min scrape intervals |
| **Intelligence** | Operational Volatility Index (OVI) | Regional + categorical scoring |
| **Human-in-the-Loop** | Community validation + enrichment | Incident Agent chat interactions |

The defensible moat: ten validated responses from sites in an affected region produce better intelligence than the signal alone. The index improves as the community participates.

---

## 2. Operational Volatility Index (OVI)

### Data Sources

| Domain | Examples | Status |
|--------|----------|--------|
| Weather | NWS alerts, MeteoAlarm, Open-Meteo | LIVE |
| Seismic | USGS earthquake data | LIVE |
| Disaster | GDACS, ReliefWeb | LIVE |
| Health | WHO, CDC alerts | LIVE |
| Cyber | CVE feeds, threat intelligence | LIVE |
| Infrastructure | Internet outage detection | LIVE |
| Financial | Market disruption signals | STALE |
| Environmental | Air quality, wildfire data | DEAD |
| Geopolitical | GDELT news events | LIVE |

### Scrape Cadence

- Default: 5-minute intervals
- Some sources: 15-minute intervals
- Design principle: **timely, not real-time**

### Index Output

Regional scoring (e.g., "OVI high in the Northeast due to X, Y, Z"). Index is enriched by human-in-the-loop validation through the Incident Agent.

> **DECISION NEEDED:** Define Minimum Viable Index (MVI) — at what point is OVI demonstrably better than constituent free signals? This is the foundational validation milestone. All tier launches, partnerships, and pricing legitimacy depend on it.

---

## 3. Incident Agent (Human-in-the-Loop)

### How It Works

1. OVI detects a regional or category event
2. Incident Agent identifies subscribers with operational exposure (e.g., site in the Philippines during a hurricane)
3. Agent initiates low-friction **Ably** in-platform chat
4. Subscriber responds with brief answers — minimal friction
5. Responses feed back into OVI to enrich the regional score with operational ground truth

### Design Principles

- Recognizable agent handle
- Low-friction queries (brief answers, not forms)
- Queries should be slightly enjoyable to answer
- Intelligence framing: "observed signal" not "alert"

---

## 4. Platform Components

| Component | Description | Status |
|-----------|-------------|--------|
| OVI Dashboard | Live volatility scoring by region and category | LIVE |
| Open MCT Dashboard | Mission Control-style operational view | LIVE |
| Incident Agent | Chat-based agent for signal validation | SPEC'D |
| Prebuilt Tools | Capacity planning, interval variance, etc. | LIVE (partial) |
| Research Agents | Statistical analysis support for subscriber datasets | SPEC'D (Sigma) |
| Adaptive (Book) | Text and audio integration into the platform | PLANNED |
| Quarterly Intelligence Briefings | Webinars + formal report | PLANNED |
| Annual In-Person Briefing | Atlanta, Miami, or rotating cities | PLANNED |

---

## 5. Pricing Tiers

### Published Self-Serve Tiers

| Tier | Annual Price | Seats | Key Capabilities |
|------|-------------|-------|------------------|
| **Individual** | $199 | 1 | Full OVI, dashboards, briefings |
| **Team** | $799 | up to 5 | Adds concurrency lock; multi-user collaboration |
| **Department** | $2,499 | up to 25 | Multi-site profile setup, limited API access |
| **Enterprise** | $9,999 | up to 75 | Priority agent queries, custom signal requests, named POC |

### Custom Tier

| Tier | Price | Inclusions |
|------|-------|------------|
| **Strategic Partner** | $25,000-$50,000+ | Dedicated agent (offshore partnership), custom CSAT dashboards, incident management RoC tied to client org, white-glove onboarding |

### Pricing Principles

- Published self-serve through Enterprise reduces sales friction
- "Contact us" reserved only for genuinely custom Strategic Partner engagements
- Per-seat economics shift from volume-based (Department) to value-based (Enterprise, Strategic)
- Department-to-Enterprise gap (4x) must be justified by feature differentiation, not just seat count

### Pricing Risk

Team tier ($799/5 seats vs. $199 individual) creates arbitrage incentive — three friends pooling into a "team" account. Concurrency lock on single-seat logins addresses single-license sharing. Acceptable at current scale; monitor.

---

## 6. Feature Differentiation by Tier

> **DECISION NEEDED:** Build out full positioning matrix. Draft below.

| Feature | Individual | Team | Department | Enterprise | Strategic Partner |
|---------|-----------|------|------------|------------|-------------------|
| OVI Dashboard | Full | Full | Full | Full | Full + custom views |
| Signal Feed | Full | Full | Full | Full | Full |
| Incident Agent | Standard | Standard | Standard | Priority | Dedicated |
| Tools | All | All | All | All | All + custom |
| API Access | - | - | Limited | Full | Full + SLA |
| Multi-site Profiles | - | - | Yes | Yes | Yes |
| Custom Signals | - | - | - | Yes | Yes |
| Named POC | - | - | - | Yes | Yes |
| Quarterly Briefings | Webinar | Webinar | Webinar + report | Webinar + report | Custom briefing |
| Annual Event | General admission | General admission | Reserved seating | VIP | Private session |
| Seat Management | - | Basic | Admin console | Admin console | White-glove |

---

## 7. Legacy Member Program

### Eligibility

First 1,000 members of existing WFM Labs community.

### Offer

- Free trial period (duration TBD)
- Locked-in legacy pricing on subscription

### Pricing Lock Structure

> **DECISION NEEDED:** Choose one:
>
> **Option A:** Legacy pricing locked for 3-5 years, with clear renewal pathway at then-current pricing
>
> **Option B:** Locked percentage discount (e.g., 30% off) sustained indefinitely against then-current price
>
> **Recommendation:** Option A (3-year lock) protects long-term economics while rewarding earliest advocates. Option B creates perpetual margin drag that compounds as pricing increases.

---

## 8. Founding Moderator Program

### Structure

- 5 founding moderators selected from existing community
- Free access while actively serving on revised WFM Labs board
- Selection criteria: credentials + demonstrated willingness to actively participate

### Selection Priorities

1. Engagement modeling (not just expertise)
2. Domain diversity across WFM verticals
3. Geographic spread for OVI validation
4. Willingness to answer Incident Agent queries (modeling the behavior for the community)

> **DECISION NEEDED:** Formal selection criteria document

---

## 9. Staffing Plan

### Resource Optimization Center (RoC)

| Layer | Function | Coverage |
|-------|----------|----------|
| AI Agents | Beacon, Sentinel, Sigma, Forecast, Atlas | 24/7 automated |
| Human Analysts | Offshore (India/Philippines) | 24/7 watch |

### Coverage Model

- Minimum **1.5 FTE** even at launch — single-staffer model creates failure mode on sick days, leave, or attrition
- Loaded cost target: **$15K-$22K/month** for redundant coverage at Strategic Partner tier
- Scale with Strategic Partner count, not total subscriber base

### Outsourcing Partner Requirements

> **DECISION NEEDED:** Contract terms for offshore partnership
>
> - Dedicated agent pool (no shared agents across BPO competitors)
> - Contractual carve-outs preventing same-agent-pool exposure
> - Non-compete clause for contact center intelligence services
> - SLA for briefing delivery cadence

---

## 10. Strategic Partner Tier — Liability Framework

### Core Positioning

**Decision support, not decision authority.**

Mental model: **Military intelligence unit, not security guard.** Intelligence units provide threat assessments; commanders decide what to do.

### Language Standards

| Avoid | Use Instead |
|-------|-------------|
| "Alert" | "Observed signal" |
| "Incident report" | "Awareness briefing" |
| "Issue" | "Pattern of interest" |
| "We watch your sites" | "We provide intelligence analysis on signals affecting your operating regions" |
| "Recommend you action this" | "For your awareness and consideration" |

### Scope Contract Requirements

Each contract explicitly defines:

- What is monitored
- Monitoring cadence (e.g., agent reviews signal dashboard 4x per business day)
- Briefing format and delivery rhythm
- What is **explicitly NOT** covered (continuous monitoring, predictive staffing variance alerting, internal operational issues)

### Cadence Model

- Scheduled intelligence briefings (daily or twice-daily), not real-time alerting
- Between-briefing outreach is a courtesy enhancement, not contracted SLA
- Structured briefing = defensible rhythm

### Contractual Disclaimers

- Best-efforts language
- No guarantee of detection
- Client retains operational responsibility
- Limitation of liability capped at fees paid
- **Must be drafted by attorney experienced in managed services contracts** (not generic SaaS terms)

---

## 11. Phased Launch Strategy

Sequencing logic: Strategic Partner tier sells **credibility**. Credibility comes from documented OVI accuracy. Accuracy requires signal-and-response volume from lower tiers. Therefore, phased launch is mandatory.

### Phase 1 — Individual + Team (Launch Simultaneously)

**Rationale:** Solo subscribers report what they see; teams report what they *did* about it. Team-level contextual feedback is more valuable for OVI model training.

**Gate:** Stripe integration complete, beta feedback incorporated.

### Phase 2 — Department Tier

**Gate:** 200+ active weekly users AND >= 60% same-day Incident Agent query response rate.

### Phase 3 — Enterprise Tier

**Gate:** 3 named reference customers AND documented OVI backtested accuracy across >= 2 regional event categories.

### Phase 4 — Strategic Partner Tier

**Gate:** At least one Enterprise customer using platform for 12+ months without major incident-attribution disputes.

---

## 12. Engagement Risk

### The Problem

OVI quality depends on participation. If first 200 subscribers lurk and don't answer Incident Agent queries, the human-in-the-loop validation layer is hollow.

### Mitigation

| Strategy | Mechanism |
|----------|-----------|
| Gamification | Visible response rate, leaderboards |
| Recognition | Status badges for top contributors |
| Low friction | Agent queries designed to be quick and slightly enjoyable |
| Social proof | Founding moderators model active participation |
| Value loop | Show contributors how their responses improved regional intelligence |

---

## 13. Open Decisions Tracker

| # | Decision | Owner | Target Date |
|---|----------|-------|-------------|
| 1 | Legacy pricing duration (3 vs 5 years) | Ted | Before Phase 1 |
| 2 | Feature-differentiation grid finalization | Ted | Before Phase 1 |
| 3 | MVI definition and measurement methodology | Ted | Before Phase 2 |
| 4 | Founding moderator selection criteria | Ted | Before Phase 1 |
| 5 | Outsourcing partner contract terms + conflict carve-outs | Ted + Attorney | Before Phase 4 |
| 6 | Quarterly briefing editorial calendar + research staffing | Ted | Before Phase 2 |
| 7 | Annual in-person event city rotation and economics | Ted | Before Phase 3 |
| 8 | Incident Agent query design and UX | Ted | Before Phase 1 |
| 9 | Concurrency lock implementation details | Engineering | Before Phase 1 |

---

## 14. Revenue Model Projections

> **DECISION NEEDED:** Validate assumptions below.

### Year 1 Target (Phase 1-2)

| Segment | Count | Revenue |
|---------|-------|---------|
| Individual | 100 | $19,900 |
| Team | 20 | $15,980 |
| **Total** | | **$35,880** |

### Year 2 Target (Phase 2-3)

| Segment | Count | Revenue |
|---------|-------|---------|
| Individual | 300 | $59,700 |
| Team | 50 | $39,950 |
| Department | 10 | $24,990 |
| Enterprise | 2 | $19,998 |
| **Total** | | **$144,638** |

### Year 3+ Target (All Phases)

| Segment | Count | Revenue |
|---------|-------|---------|
| Individual | 500 | $99,500 |
| Team | 100 | $79,900 |
| Department | 25 | $62,475 |
| Enterprise | 5 | $49,995 |
| Strategic Partner | 1 | $35,000 |
| **Total** | | **$326,870** |

*These projections are placeholders. Refine after Phase 1 conversion data is available.*
