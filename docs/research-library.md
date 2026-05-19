# Research Library Architecture

**Owner:** RESEARCH fleet agent
**Last updated:** 2026-05-18
**Status:** Active build — Phase 1 (metadata + harvest) complete, Phase 2 (full-text + vectors) in progress

---

## Purpose

The WFM Labs Research Library is a curated, searchable collection of academic papers, industry reports, and practitioner resources relevant to workforce management. The library serves two audiences:

1. **Human members** — browse, search, and discover papers through the Hub frontend
2. **Beacon agent** — reads full paper text to synthesize evidence-backed answers to member research questions

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        DISCOVERY                              │
│  Neon Postgres — papers table                                 │
│  title, authors, abstract, category, DOI, year, sourceUrl     │
│  Full-text search via GIN indexes on title + abstract          │
│                                                                │
│  How it's used: Browse by category, keyword search, filters    │
├──────────────────────────────────────────────────────────────┤
│                     COMPREHENSION                              │
│  Neon Postgres — papers.full_text + paper_chunks table         │
│  pgvector (v0.8.0) — 1536-dim embeddings per chunk            │
│  Cosine similarity search for semantic matching                │
│                                                                │
│  How it's used: Beacon reads full_text for synthesis.          │
│  Semantic search finds "micro-breaks" when user asks about     │
│  "brief rest intervals" or "recovery pauses"                   │
├──────────────────────────────────────────────────────────────┤
│                     SOURCE FILES                               │
│  Cloudflare R2 — wfmlabshub-media bucket (media/ prefix)       │
│  Payload Media collection — PDF uploads                        │
│  papers.pdfFile → media record → R2 object                     │
│                                                                │
│  How it's used: Download links for members, source of truth    │
│  for text extraction pipeline                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Model

### papers table (Payload CMS collection)

| Field | Type | Purpose |
|-------|------|---------|
| title | text (required) | Paper title |
| slug | text (required, unique) | URL-safe identifier |
| primaryContributor | relationship → members | Owner (Beacon for bulk imports) |
| sourceUrl | text (required) | DOI link or publisher URL |
| sourceType | enum | arxiv, ssrn, journal, industry-report, blog, vendor-research, manual |
| sourceName | text | Journal or publisher name |
| category | enum | See categories below |
| authors | array | name + affiliation per author |
| abstract | textarea | Paper abstract (discovery layer) |
| fullText | textarea | Extracted full paper text (comprehension layer) |
| curatorSummary | richText | Beacon or member-written summary |
| whyItMatters | richText | WFM practitioner relevance |
| caveats | richText | Limitations and context |
| pdfFile | upload → media | Original PDF in R2 |
| description | textarea | Brief overview (inherited from base) |
| topics | relationship → topics[] | Fine-grained multi-tag taxonomy |
| status | enum | draft → published → refined → mature |
| tier | enum | public, free, practitioner, practitioner-plus |
| publishedAt | date | Original publication date |
| stats | group | discussionCount, reactionCount, viewCount, citationCount |

### paper_chunks table (planned — for vector search)

| Field | Type | Purpose |
|-------|------|---------|
| id | serial | Primary key |
| paper_id | integer | FK → papers.id |
| chunk_index | integer | Position in document |
| content | text | Chunk text (~500 tokens) |
| embedding | vector(1536) | OpenAI/Anthropic embedding |
| section_title | text | Section header if available |
| created_at | timestamptz | Timestamp |

### Categories (enum_papers_category)

| Value | Label | Count (current) |
|-------|-------|-----------------|
| employee-wellbeing | Employee Well-Being | 39 |
| workforce-management | Workforce Management | 30 |
| ai-machine-learning | AI & Machine Learning | 27 |
| process-optimization | Process Optimization | 27 |
| analytics-forecasting | Analytics & Forecasting | 26 |
| queuing-theory | Queuing Theory | 23 |
| contact-center-operations | Contact Center Operations | 20 |
| customer-experience | Customer Experience | 16 |
| technology | Technology | 15 |
| operations-management | Operations Management | 6 |
| scheduling-optimization | Scheduling & Optimization | 4 |
| economics-finance | Economics & Finance | 2 |
| other | Other | 0 |

---

## Pipeline

### Phase 1: Harvest & Import (COMPLETE)

```
Titles (from legacy site, manual entry, or discovery)
  → harvest-papers.ts (CrossRef API + Semantic Scholar API)
  → Enriched metadata: DOI, authors, abstract, journal, year, open access URL
  → import-harvested.ts (direct SQL insert into Neon)
  → papers + papers_authors tables populated
```

**Tools built:**
- `02-working/parse-legacy-titles.ts` — parse legacy site export into categorized title lists
- `02-working/harvest-papers.ts` — single paper or file-based harvest via CrossRef + S2
- `02-working/harvest-all-legacy.ts` — batch harvest with resume support
- `02-working/import-papers.ts` — import from FOW-Value research collections
- `02-working/import-harvested.ts` — import harvested papers with dedup + logging

### Phase 2: Full-Text Acquisition (IN PROGRESS)

```
papers table (sourceUrl, openAccessUrl)
  → Download PDFs where available (open access, author sites, preprints)
  → Store PDF in R2 via Payload Media collection
  → Extract text (pdf-parse or similar)
  → Write to papers.full_text
  → Chunk text (~500 tokens per chunk)
  → Generate embeddings (text-embedding-3-small or similar)
  → Store in paper_chunks table with vector column
```

**Open access sources (priority order):**
1. arXiv preprints (free, reliable)
2. Author personal sites (Columbia, Wharton, MIT)
3. MDPI journals (open access)
4. PubMed Central
5. Semantic Scholar open access PDF URLs (8 found in harvest)
6. SciELO Brazil (open access)

**Paywalled papers:** Store metadata + abstract only. Full text added when/if obtained through institutional access, author sharing, or Sci-Hub (manual decision by Ted).

### Phase 3: Beacon Agent

```
Member query: "I need research to support introducing micro-breaks"
  → Beacon worker (Cloudflare Worker)
  → Step 1: Semantic search — cosine similarity on paper_chunks.embedding
  → Step 2: Retrieve top-N chunks + parent papers
  → Step 3: Load full_text for top papers
  → Step 4: Claude Sonnet synthesizes business case with citations
  → Response: structured answer + cited papers + PDF links
```

**Beacon design:**
- Cloudflare Worker at roc.wfmlabs.com/beacon/search
- Input: natural language query
- Model: Claude Sonnet for synthesis
- Output: { answer, citations: [{ paperId, title, relevantExcerpt, doi }] }
- Member profile: username=beacon, type=agent, id=5

### Phase 4: Continuous Curation

- Beacon monitors new papers via CrossRef alerts / arXiv RSS
- Auto-harvests metadata, flags for Ted's review
- Members can submit papers (isPaperSubmission flow)
- Quality scoring based on citations, relevance, recency

---

## Search Strategy

### Current: Postgres Full-Text Search

For metadata search (title, abstract, description):
```sql
-- GIN index (to be created)
CREATE INDEX idx_papers_search ON papers
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'') || ' ' || coalesce(description,'')));

-- Query
SELECT * FROM papers
WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,''))
  @@ plainto_tsquery('english', 'micro breaks burnout');
```

### Future: Semantic Vector Search (pgvector)

For meaning-based search across full paper content:
```sql
-- Find chunks similar to query embedding
SELECT pc.content, p.title, p.id,
       1 - (pc.embedding <=> $1::vector) as similarity
FROM paper_chunks pc
JOIN papers p ON p.id = pc.paper_id
ORDER BY pc.embedding <=> $1::vector
LIMIT 20;
```

**Embedding model:** OpenAI text-embedding-3-small (1536 dims, $0.02/1M tokens)
- 235 papers × ~5,000 tokens avg = ~1.2M tokens = ~$0.024 for initial corpus
- Scales linearly — 1,000 papers ≈ $0.10

### Hybrid Search (production)

Combine both for best results:
1. Vector search finds semantically relevant chunks
2. Full-text search boosts exact keyword matches
3. Category filter narrows to relevant domain
4. Reciprocal rank fusion merges results

---

## Storage & Costs

| Resource | Current Usage | Limit | Cost |
|----------|--------------|-------|------|
| Neon Postgres | ~50MB (235 papers, metadata) | 512MB (free tier) | $0 |
| Neon + full_text | ~200MB estimated (with text) | 512MB free, then $19/mo | $0-19/mo |
| Neon + vectors | ~300MB estimated (1536-dim, 1000 papers) | Scales with storage | Included |
| R2 storage | ~0 (no PDFs yet) | 10GB free | $0 |
| R2 with PDFs | ~500MB estimated (500 papers avg 1MB) | 10GB free | $0 |
| Embeddings | One-time | — | ~$0.10 for 1000 papers |

---

## File Locations

| Path | Purpose |
|------|---------|
| `~/projects/wfmlabs-hub/src/collections/Papers.ts` | Paper collection schema |
| `~/projects/wfmlabs-hub/src/app/(frontend)/research/` | Research page frontend |
| `~/projects/wfmlabs-hub/docs/research-library.md` | This document |
| `~/cloud/projects/wfmlabs-fleet-research/01-source/` | Source data (legacy export, handover) |
| `~/cloud/projects/wfmlabs-fleet-research/02-working/` | Harvest tools, import scripts, staging |
| `~/cloud/projects/wfmlabs-fleet-research/03-output/` | Completed deliverables, import logs |
| `~/projects/roc/workers/` | Beacon worker (Cloudflare Worker) |

---

## Cross-Agent Dependencies

| This Agent Needs | From Agent | What |
|-----------------|------------|------|
| Beacon worker deployment | API fleet | Cloudflare Worker deploy pipeline |
| Topic taxonomy seeded | RESEARCH (self) | Populate topics table for paper tagging |
| Frontend search UI | HUB fleet | Research page search/filter enhancements |
| Member paper submissions | HUB fleet | Submission form + review workflow |
