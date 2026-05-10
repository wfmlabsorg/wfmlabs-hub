# Deployment — WFM Labs Hub

**Updated when:** Deployment configuration changes

---

## Status

Not yet deployed. This document will be populated during Week 1 when Vercel project is created.

## Target Architecture

```
GitHub (wfmlabsorg/wfmlabs-hub)
  │
  ├── PR opened → Vercel Preview Deployment
  │                (unique URL per PR)
  │
  └── Merge to main → Vercel Production Deployment
                       (community.wfmlabs.com)
```

## Services to Create

| Service | Account | Project Name | Status |
|---------|---------|-------------|--------|
| Vercel | Ted's account | wfmlabs-hub | Not created |
| Neon | Ted's account | wfmlabs-hub | Not created |
| Cloudflare R2 | Ted's account | wfmlabshub-media | Not created |
| Resend | Ted's account | (existing) | Domain setup needed |
| GitHub | wfmlabsorg | wfmlabs-hub | Not created |

## Environment Variables

See `wfmlabs-platform-seed-v1.1.md`, Appendix C for full list.

### Required for Phase 1
```
PAYLOAD_SECRET          # Random 32-char string
NEXT_PUBLIC_SERVER_URL  # https://community.wfmlabs.com
DATABASE_URI            # Neon connection string
R2_ACCESS_KEY_ID        # Cloudflare R2
R2_SECRET_ACCESS_KEY    # Cloudflare R2
R2_BUCKET               # wfmlabshub-media
R2_ENDPOINT             # Cloudflare R2 endpoint
R2_PUBLIC_URL           # Public URL for media
RESEND_API_KEY          # Resend
RESEND_FROM_EMAIL       # hello@community.wfmlabs.com
```

### Setup in Vercel
All environment variables set in Vercel dashboard → Settings → Environment Variables. Different values for Preview and Production environments.

### Local Development
Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

## DNS

| Domain | Provider | Record | Target |
|--------|----------|--------|--------|
| community.wfmlabs.com | Cloudflare | CNAME | cname.vercel-dns.com |

## Rollback

Vercel supports instant rollback to any previous deployment via dashboard or CLI:
```bash
vercel rollback [deployment-url]
```
