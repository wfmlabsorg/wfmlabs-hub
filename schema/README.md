# Hub raw-SQL migrations (`schema/`)

Raw-SQL migrations for assets that live **outside** Payload's managed schema
(vector tables, ANN indexes, pgvector). Mirrors the roc repo's `schema/NNN_*.sql`
convention. **FOREMAN applies these post-merge** (`psql $WFMLABS_HUB_DATABASE_URL
-f schema/NNN_*.sql`) — they are never run in-session and never via Payload push.
Every file is idempotent (`IF NOT EXISTS`).

Payload-managed tables (the `papers` collection, etc.) are still migrated through
`src/migrations/` (Payload/Drizzle). Where a raw-SQL column lands on a
Payload-managed table (e.g. `papers.full_text_source/_status`), the matching
Payload field is also added in `src/collections/Papers.ts` so the model and DB
agree and Payload detects no drift.

| File | Adds |
|------|------|
| `001_deep_research_db.sql` | `research_cards` + card embedding + HNSW index; `papers.full_text_source/_status`; ensures `vector` ext. (research-010 / WFM-84) |

---

## The Research Card contract (code against this)

`research_cards` holds one structured deep-comprehension card per paper, 1:1 with
`papers` (`UNIQUE (paper_id)`, regeneration UPSERTs on `paper_id`). research-012
writes cards; research-013 fills `embedding`; research-014 (Beacon) reads them.

| Column | Type | Meaning |
|--------|------|---------|
| `paper_id` | `integer` FK → `papers(id)` ON DELETE CASCADE | The paper this card describes. |
| `thesis` | `text` | The paper's central claim, 1–2 sentences. |
| `method` | `jsonb` | `{design, sample_n, setting}`. `design` ∈ RCT / observational / qualitative / framework / benchmark. |
| `key_findings` | `jsonb` (array) | Each: `{finding, stat_or_quote, locator}` — finding + the specific stat/quote backing it + where in the paper. |
| `evidence_strength` | `text` | Single letter on Beacon's A–V scale. |
| `evidence_justification` | `text` | One-line reason for the grade. |
| `problem_tags` | `text[]` | Decisions/questions the paper bears on (e.g. `CES validity`, `FCR↔churn`, `agent attrition`). GIN-indexed. |
| `limitations` | `text` | Generalizability / age / vendor-interest caveats. |
| `applicable_questions` | `text[]` | Member questions this paper can help answer. |
| `key_quotes` | `jsonb` (array) | Each: `{quote, locator}` — verbatim, for no-fabrication grounding. |
| `source_basis` | `text` CHECK | `full_text` \| `abstract_only` — what the card was generated from. |
| `card_model` | `text` | Model that produced the card (e.g. `claude-sonnet-4-6`). |
| `generated_at` | `timestamptz` | When the card content was generated. |
| `card_status` | `text` CHECK, default `pending` | `pending` \| `generating` \| `complete` \| `failed` \| `stale`. |
| `embedding` | `vector(1024)` | Card-level bge-m3 embedding for card-first kNN. Filled by research-013; HNSW cosine index `idx_research_cards_embedding`. |

**JSONB element shapes (the no-fabrication contract):**

```jsonc
method:       { "design": "RCT", "sample_n": 1200, "setting": "US BPO contact centers" }
key_findings: [ { "finding": "...", "stat_or_quote": "23% reduction (p<0.01)", "locator": "p.7, Table 3" } ]
key_quotes:   [ { "quote": "verbatim text ...", "locator": "p.4 §3.2" } ]
```

`stat_or_quote`/`quote` must be **verbatim** from the source text (`source_basis`).

### Design rationale (table vs JSONB-on-papers)

A dedicated `research_cards` table (hybrid: structured columns for what we
filter/scan on, JSONB for nested arrays) rather than a `research_card` JSONB
column on `papers`, because: (1) the card-level pgvector embedding + HNSW index
do not fit Payload's `papers` schema model and would risk drift — a raw table
outside Payload (like `paper_chunks`) decouples the vector concern cleanly;
(2) cards have an independent lifecycle (regenerate/re-embed) without rewriting
+ re-indexing large `papers` rows; (3) `evidence_strength`, `source_basis`,
`card_status`, and `problem_tags[]` are first-class filterable columns.

## Embedding model + dimension

The program upgrades MiniLM-384 → `@cf/baai/bge-m3` (**1024-d**). New vector
columns are sized `vector(1024)`. `paper_chunks.embedding` stays `vector(384)`
in this migration (pgvector can't resize a column in place with data present);
research-013 truncates + resizes + re-embeds chunks to 1024-d and swaps the
ivfflat index for HNSW — the exact DDL is documented inline in
`001_deep_research_db.sql` §3.
