# ADR 0007: Resend for Transactional Email

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Need transactional email for welcome, verification, password reset, and discussion notifications.

## Decision

Resend as email provider with React Email for TypeScript-native templates. Ted already has a Resend account.

## Alternatives considered

### SendGrid / Postmark
Established providers. **Rejected:** Resend has better TypeScript ergonomics and Ted already has an account.

### AWS SES
Cheapest option. **Rejected:** More ops overhead for minimal cost savings at this scale.

## Consequences

### Positive
- TypeScript-native API
- React Email templates (type-safe, testable)
- Already in Ted's stack
- Clean integration with Next.js

### Negative
- Younger company than SendGrid/Postmark (mitigated by simple provider switch if needed)

## References

- Seed doc v1.1, Section 12
