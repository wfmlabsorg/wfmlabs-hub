# API Reference — WFM Labs Hub

**Updated when:** API endpoints change

---

## Status

API not yet built. This document will be populated during Week 2-3 when Payload collections are created.

## Payload Auto-Generated APIs

Payload CMS 3.x automatically generates REST and GraphQL APIs for every collection:

### REST (expected)
```
GET    /api/members          List members
GET    /api/members/:id      Get member by ID
POST   /api/members          Create member
PATCH  /api/members/:id      Update member
DELETE /api/members/:id      Delete member

GET    /api/papers           List papers
GET    /api/papers/:id       Get paper by ID
POST   /api/papers           Create paper
...
(same pattern for all collections)
```

### GraphQL
Available at `/api/graphql` with auto-generated schema.

### Authentication
- `POST /api/members/login` — email + password → JWT
- `POST /api/members/logout` — invalidate token
- `POST /api/members/forgot-password` — trigger reset email
- `POST /api/members/reset-password` — complete reset

### Custom Routes (planned)
```
GET /api/search?q=...&type=...    Full-text search (Postgres FTS)
```

## External API Consumers (future)

| Consumer | Auth Method | Access Level | Phase |
|----------|------------|--------------|-------|
| Hub frontend | Cookie/JWT (same deploy) | Full | 1 |
| wfmlabs.com tool catalog | Public API or API key | Read-only tool metadata | 4+ |
| Beacon agent | API key | Read/write papers, discussions | 3 |
| Caso agent | API key | Read/write scenarios, discussions | 4 |
| Member-owned agents | Personal API key | Read-only, tier-gated | 4+ |
| ROC / Open MCT | API key | Read/write scenarios | 4 |
