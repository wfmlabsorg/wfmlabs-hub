# ADR-0019: Value Strategy — Core Assets & Revenue Model

**Date:** 2026-05-12
**Status:** Accepted
**Deciders:** Ted Lango

## Thesis

Content is commoditized. Intelligence infrastructure is not. WFM Labs Hub sells access to an operational intelligence platform where AI agents and human practitioners collaborate on live data. The subscription pays for intelligence, not content.

## Core 3 Assets

### 1. OVIX / OpIntel (Operational Intelligence)
The real-time intelligence engine. 28 data feeds scored every 5 minutes across 38 global regions and 118 metro hubs. Weather, seismic, disaster, cyber, health, financial, infrastructure — correlated to workforce geography.

**Status:** Built and operational.
**Defensibility:** Nobody else correlates operational disruption risk at this granularity for WFM. The contributor network's workforce footprint data makes it uniquely precise.

### 2. Intelligence Briefings (Quarterly + Annual Event)
Agent-drafted, practitioner-validated synthesis of operational trends. Quarterly 90-minute virtual briefings plus one annual private summit.

- **Quarterly Briefing:** OVIX trends, Beacon's top findings, community data synthesis, practitioner spotlight. Recorded for subscribers. Format: "earnings call for WFM operations."
- **Annual Summit:** 1-day hybrid event. Keynotes, practitioner panels, live OVIX walkthrough. Limited to subscribers. 100-200 attendees.

**Status:** Not built yet. Beacon can draft quarterly content. Event infrastructure TBD.
**Defensibility:** Synthesized from proprietary OVIX data + contributor insights. Can't be replicated without the data.

### 3. Custom WFM Agents (Agent-as-a-Service)
Purpose-built AI agents trained on WFM methodology, connected to OVIX data, and customizable to subscriber operations. Not general-purpose AI — domain-specific agents that DO things.

**Examples:**
- Personalized OVIX alerts matched to your workforce footprint
- Automated weekly ops briefing for your regions
- Vendor location monitoring with failover recommendations
- Forecasting pattern analysis with adjustment recommendations
- BPO risk assessment for your outsourced locations

**Status:** Architecture exists (Beacon is the reference implementation). Custom agent framework not built yet.
**Defensibility:** Agents trained on proprietary methodology + connected to OVIX data + personalized to subscriber's workforce topology. Triple moat.

## How They Reinforce Each Other

```
OVIX (data layer)
  → feeds Intelligence Briefings (synthesis layer)
  → powers Custom Agents (action layer)
  → enriched by Contributor Network (human signal)

Subscriber joins → fills out workforce footprint
  → OVIX personalizes to their regions
  → Custom agents calibrate to their operation
  → Intelligence Briefings include their sector analysis
  → Network effects: more contributors = better data = better agents
```

## Revenue Model

### Subscription Tiers (Annual)

| Tier | Price | Seats | Core 3 Access |
|------|-------|-------|---------------|
| Individual | $199/yr | 1 | OVIX + community agents (Beacon) + briefings (recorded) |
| Team | $799/yr | 5 | + custom team agent + briefings (live) + team workspace |
| Corporate | $2,499/yr | 25 | + multiple custom agents + API access + SSO + annual summit VIP |

### Additional Revenue Streams (Future)
- Annual Summit tickets (non-subscriber pricing)
- Maturity Assessment as consulting service (corporate tier)
- Agent marketplace (third-party agents on the platform)
- Data licensing (anonymized, aggregated OVIX + workforce data)

## Competitive Position

**What competitors have:** Content libraries, webinars, certification programs, spreadsheet tools.

**What they don't have:**
- Live operational intelligence scored by AI agents across a global region hierarchy
- A practitioner network sharing real workforce footprint data
- Custom AI agents connected to operational data and WFM methodology
- Agent-human collaboration loops (Beacon model)

**The moat deepens with each subscriber:** More contributors = denser footprint data = more precise OVIX = more valuable agents = better briefings = more subscribers.

## Implementation Sequence

### Phase 1 (Current — Q2 2026)
- [x] OVIX operational, 28 feeds, scoring active
- [x] Beacon agent live (community knowledge scout)
- [x] Hub deployed with profiles, discussions, signals
- [ ] Pricing page (coming soon)
- [ ] Landing page for non-subscribers

### Phase 2 (Q3 2026)
- [ ] Stripe integration (checkout, billing portal, webhook)
- [ ] Access gating middleware (tier-based content access)
- [ ] First Intelligence Briefing (Q3 report)
- [ ] Team management (invite, seat pool)

### Phase 3 (Q4 2026)
- [ ] Custom agent framework (beyond Beacon)
- [ ] Annual Summit (Q4 2026)
- [ ] Corporate tier features (SSO, API access)
- [ ] Agent personalization (OVIX alerts matched to footprint)

### Phase 4 (2027)
- [ ] Agent marketplace
- [ ] Data products
- [ ] Maturity Assessment service
- [ ] International expansion of event program
