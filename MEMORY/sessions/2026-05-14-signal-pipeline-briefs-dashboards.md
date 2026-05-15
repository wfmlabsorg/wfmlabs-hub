# Session: Signal Pipeline, Briefs, Dashboard Upgrades

Date: 2026-05-14
Phase: Build (deployed, operational)

## Summary
Major operational improvements session. Fixed signal pipeline, created Briefs collection, retuned Sentinel voice, redesigned articles, upgraded financial and environmental dashboards.

## Signal Pipeline Overhaul
- OVIX scoring engine disabled from posting signals (was 97% weather flood)
- Sentinel is now sole signal poster with domain-diverse SQL
- Fixed empty SENTINEL_API_KEY in Vercel production
- Hub /api/signals accepts both X-ROC-API-Key and X-SENTINEL-API-KEY
- Claude API calls capped at 5 per cycle
- Signal categories now include environmental
- 48-hour auto-purge via Vercel cron

## Briefs Collection (New)
- Operational intelligence separated from Articles
- Category color-coded by OVIX domain
- Brief types: incident, summary, analysis
- Sentinel writes briefs for severity >= 7 events
- Browse page at /briefs with filters + pagination
- Detail page with color band + discussions

## Sentinel Voice Retune
- Rewrote from prescriptive ("ACTIVATE IMMEDIATELY") to informative ("factors to consider")
- Military intelligence briefing tone
- Distinguishes routine events from emergencies

## Articles Redesign
- Category-specific gradient cards
- Article submission flow at /articles/submit
- Purged 66 Sentinel articles, kept 4 Beacon articles
- Updated Beacon articles with proper categories + excerpts

## Beacon Fixes
- Fixed duplicate comment bug (dedup by comment ID)
- Fixed threading (replies use parentDiscussionId)
- Removed question reaction type

## Financial Dashboard Upgrade
- TradingView widgets: ticker tape, economic calendar, market overview
- 3-column layout: Calendar | FRED indicators | Market Overview
- FSI gauge preserved

## Environmental Dashboard Overhaul
- Replaced dead OpenAQ with Open-Meteo Air Quality (free, no key)
- 24 global regions queried for AQI, PM2.5, PM10, NO2, Ozone, UV
- FIRMS came back online, EONET wildfires as backup
- Feed health: 23 feeds, 19 healthy (up from 15)

## Interactive Globe
- Standalone Cesium globe on homepage (drag/zoom/rotate)
- OVIX markers colored by score, hover tooltips
- Auto-rotation with 8s idle resume

## Membership Strategy
- docs/membership-strategy.md created
- 5 tiers, phased launch, liability framework
- Stripe integration targeted Q4 2026

## Commits (Hub)
100+ total commits on hub, ~10 ROC commits this session

## What's Next
- Geopolitical dashboard — shows weather events, needs proper data source
- Travel dashboard — same issue
- Health dashboard — duplicate entries
- Cyber dashboard — KEV dates not displaying
- Homepage globe polish
- Sigma agent prototype
