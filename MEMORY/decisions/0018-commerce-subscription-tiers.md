# ADR-0018: Commerce — Subscription Tiers & Gating

**Date:** 2026-05-12
**Status:** Accepted
**Deciders:** Ted Lango

## Decision

Everything behind community.wfmlabs.com is gated. No free content access.

### Tiers
- **Free:** Landing page + pricing page only
- **Trial:** 30 days full access, auto-expires
- **Individual:** $199/yr, 1 seat
- **Team:** $799/yr, 5 seats
- **Corporate:** $2,499/yr, 25 seats + SSO + API access
- **Founding Member:** Lifetime price lock at first-paid tier

### Payment
- Stripe via Specialty Directories LLC / GearPress account
- Annual billing only
- Stripe Checkout for subscription, Stripe Customer Portal for management

### Gating
- Unauthenticated → landing page + pricing
- Authenticated + no subscription → subscribe prompt
- Authenticated + active subscription → full access
- Trial expired → locked

### Phase 1 (Now)
- Coming soon landing page with feature showcase + pricing
- Email collection for waitlist
- No Stripe integration yet

### Phase 2 (Before launch)
- Stripe products/prices/checkout
- Subscription middleware
- Team management
- Billing portal
