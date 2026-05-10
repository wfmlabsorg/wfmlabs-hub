# ADR 0006: Cloudflare R2 for Object Storage

**Date:** 2026-05-09
**Status:** Accepted
**Authors:** Ted Lango, TARS

## Context

Need object storage for user-uploaded PDFs, images, avatars, and media. Already using Cloudflare R2 for `tars-storage` bucket across the PAI infrastructure.

## Decision

Cloudflare R2 with Payload's `@payloadcms/storage-r2` adapter. S3-compatible API. Bucket: `wfmlabshub-media`.

## Alternatives considered

### Vercel Blob
Built into Vercel. **Rejected:** More expensive than R2, less control, vendor lock-in to Vercel.

### AWS S3
Industry standard. **Rejected:** Already using R2 across TARS infrastructure. No reason to add another cloud provider.

## Consequences

### Positive
- Already in TARS stack (familiar)
- Cheaper than alternatives (no egress fees)
- S3-compatible (portable)
- Versioning available

### Negative
- Cloudflare R2 CDN needs custom domain + caching config for optimal media delivery

## References

- Seed doc v1.1, Section 5.1
