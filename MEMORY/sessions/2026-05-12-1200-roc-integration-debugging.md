# Session: ROC Integration Debugging

Date: 2026-05-12 12:00
Phase: Build (ROC integration, active debugging)

## Goal
Get ROC/OpenMCT fully functional within community.wfmlabs.com

## What we fixed
1. **Domain mismatch** — community.wfmlabs.com was pointed at wrong Vercel project (`wfmlabs-hub-local`). Moved domain to `wfmlabs-hub` project.
2. **DNS** — Updated from A record (76.76.21.21) to CNAME (e107fe4c33533a27.vercel-dns-017.com) in Netlify DNS
3. **Database schema** — Profile redesign columns missing from production Neon. Dev mode push added all missing columns (industry, ovixProfile_*, workforceTypes, etc.)
4. **DATABASE_URI** — Removed `channel_binding=require` parameter that was blocking connections
5. **OAuth** — Reset AUTH_URL, added AUTH_TRUST_HOST=true for Vercel
6. **Hub session bridge** — Made blocking (Promise-based) so login gate waits for session check
7. **ROC profile modal** — Suppressed for Hub-authenticated users (profile lives at /me/setup)
8. **CORS** — Added community.wfmlabs.com to ROC Worker's ALLOWED_ORIGINS, deployed Worker
9. **Asset paths** — Updated globe, dashboards, maps iframe URLs from `/` to `/roc/` prefix
10. **X-Frame-Options** — Changed from DENY to SAMEORIGIN for `/roc/` paths so iframes load

## Current status
- Dashboards: LOADING (confirmed working)
- Globe: Blue/empty (Cesium loading but no tiles or data)
- Watchlist slider: Empty
- Auth bridge: Hub login → ROC auto-unlock working
- ROC Worker: Deployed with CORS fix, cron reactivated

## Still debugging
- Globe needs Cesium token / Google Maps key (served via /api/ovix/config endpoint)
- Watchlist may need user preferences from ROC DB

## Commits this session
- `864b4e7` (Hub) — fix: CDN cache headers for /roc paths
- `9eb8d8e` (Hub) — fix: make Hub session bridge blocking
- `0c734a5` (Hub) — fix: skip ROC profile modal for Hub users
- `d508483` (Hub) — fix: update ROC internal paths from / to /roc/
- `748a2b6` (Hub) — fix: allow iframing for /roc/ paths (SAMEORIGIN)
- `54133d0` (ROC) — fix: add community.wfmlabs.com to CORS allowed origins
