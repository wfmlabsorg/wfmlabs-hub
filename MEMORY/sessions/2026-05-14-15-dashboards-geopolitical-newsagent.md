# Session: Dashboards, Geopolitical Intelligence, NewsIntel Agent

Date: 2026-05-14 through 2026-05-15
Phase: Build (operational, all dashboards upgraded)

## Summary
Major session spanning signal pipeline fixes, content taxonomy (Briefs), dashboard upgrades across Financial/Environmental/Geopolitical/Travel, and building the NewsIntel geopolitical intelligence agent from scratch.

## Signal Pipeline Overhaul
- OVIX scoring engine disabled from posting signals (was 97% weather)
- Sentinel sole signal poster with domain-diverse SQL
- Fixed SENTINEL_API_KEY empty in Vercel production
- Sentinel switched to Haiku (was Sonnet) — saves ~$2/day
- 48-hour signal auto-purge via Vercel cron

## Operational Briefs (New Collection)
- Briefs collection for Sentinel-generated intelligence
- Category color-coded by OVIX domain
- Sentinel writes briefs for severity >= 7 events
- Browse/detail pages at /briefs

## Sentinel Voice Retune
- Situational awareness briefings, not prescriptive action plans
- "May affect" language, never "activate immediately"
- Military intelligence briefing tone

## Articles Redesign
- Category-specific gradient cards
- Article submission flow at /articles/submit
- Purged 66 Sentinel articles, kept 4 Beacon articles
- Beacon articles updated with proper categories/excerpts

## Discussion Fixes
- Removed question reaction type
- Fixed Beacon duplicate comment bug + threading

## Financial Dashboard
- TradingView widgets: ticker tape, economic calendar, market overview
- 3-column layout: Calendar | FRED indicators | Market Overview
- FSI gauge preserved

## Environmental Dashboard
- Replaced dead OpenAQ with Open-Meteo Air Quality (free, no key)
- Added extreme heat, dust, UV as separate event types
- 4-panel layout: Air Quality | Heat | UV & Dust | Wildfires
- Composite scoring: weighted average, not max

## Geopolitical Intelligence (Major Build)
### NewsIntel Worker (news-intel.tedlango.workers.dev)
- New Cloudflare Worker for geopolitical headline pipeline
- Google News RSS (4 feeds per cycle, 8 rotating search queries)
- Claude Haiku classification with BPO-country weighting
- Claude Haiku story clustering with trajectory tracking
- Tables: news_headlines, geopolitical_stories (Neon ROC DB)

### Classification Tuning
- 18 high-priority BPO countries listed with +1-2 point weighting
- 11 calibration examples for consistent scoring
- Strict not_relevant filters: corporate actions, local US transit, non-BPO countries
- Archival articles (>7 days old) auto-filtered
- Age labels in prompts ("3h ago", "2d ago")

### Story Clustering
- Groups 60+ headlines into 10-12 distinct stories
- Trajectory tracking: emerging/escalating/peak/steady/declining/resolved
- Incremental: existing stories fed as context for trajectory comparison
- Max 12 stories, minimum 2 headlines per story
- Merge cause+effect (conflict + aviation disruption = one story)

### Geopolitical Dashboard
- 2x2 panel layout: Conflict | Trade & Economics | Labor | Regulation & Sanctions
- Compact cards matching cyber dashboard pattern
- Expandable details on click
- Risk index calibrated: current environment reads OVIX 8.1 (CRITICAL)
- Factor bars: Conflict 35%, Trade 25%, Labor 20%, Reg 20%
- Last-updated timestamps

## Travel Dashboard
- Fixed weather-dominated generic query
- Targeted parallel fetches by domain

## Homepage
- Interactive Cesium globe
- AssetCard-styled featured tools
- Compact signal feed (5 items)

## Agent Roster (Final State)
| Agent | Model | Role | Cost/day |
|-------|-------|------|----------|
| Sentinel | Haiku | Operational signals + briefs | ~$0.30 |
| Beacon | Sonnet | Community articles + engagement | ~$0.10 |
| NewsIntel | Haiku (classify) + Haiku (cluster) | Headlines + stories | ~$0.05 |
| Total | | | ~$0.45 |

## Feed Health (Session End)
- 23+ feeds total, 19+ healthy
- New: Open-Meteo AQ (environmental), Open-Meteo Heat, NewsIntel (geopolitical)
- Fixed: FIRMS came back online
- Stale: FRED (monthly cadence), aviation (intermittent)

## Key Commits
- Hub: 27 commits (signal pipeline, briefs, articles, dashboards, geopolitical category)
- ROC: 24 commits (Sentinel tuning, OVIX engine, NewsIntel worker, dashboard fixes)

## What's Next
- Health dashboard duplicate entries fix
- Cyber dashboard KEV dates display
- Sigma agent prototype
- Member context: personalize scoring based on workforce footprint
- Content seeding for beta launch
