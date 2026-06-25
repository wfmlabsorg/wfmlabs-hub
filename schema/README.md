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
| `002_paper_chunks_bge_m3_rebuild.sql` | **Destructive + sequenced.** `paper_chunks.embedding` 384→`vector(1024)` (TRUNCATE + resize), ivfflat → HNSW cosine index, for the bge-m3 upgrade. Empties `paper_chunks` until the `paper-embed` worker (roc, research-013) re-embeds the corpus. Idempotent/re-run-safe (skips the truncate when already 1024-d). Apply → `paper-embed` /backfill → deploy research-014. (research-013 / WFM-87) |
| `003_beacon_cases.sql` | `beacon_cases` — analyst cases; a member has MANY (one row per case, Beacon Case Canvas root). Non-destructive, idempotent. FK `member_id → members(id)` ON DELETE CASCADE; indexes on `member_id` and `(member_id, updated_at DESC)`. Holds the case lifecycle (`status` draft\|assembled\|exported) + the `commission` / `evidence_pool` / `arguments` / `sections` JSONB contract below. (research-016 / WFM-90) |

---

## The Beacon Case contract (code against this)

`beacon_cases` holds analyst cases — a member may have **many** (one row per
case, saved & listed via `/api/beacon/cases`; no `unique(member_id)`) (`member_id` FK →
`members(id)` ON DELETE CASCADE). It is a raw table outside Payload (like
`research_cards`): the case is a high-churn working document with deeply nested,
variable-shape JSONB driven by the `/api/beacon/*` engine, not the Payload admin
UI. research-017 (engine) reads/writes it; research-018 (UI) renders it;
research-019 (export) reads an assembled case. **This is the shared contract —
keep it in sync with `schema/003_beacon_cases.sql`.**

| Column | Type | Meaning |
|--------|------|---------|
| `id` | `bigserial` PK | Case id. |
| `member_id` | `integer` FK → `members(id)` ON DELETE CASCADE | Owning member; every route ownership-checks this. |
| `title` | `text` | Human-facing case title (often the sharpened question). |
| `status` | `text` CHECK, default `draft` | `draft` \| `assembled` \| `exported`. |
| `commission` | `jsonb` | Locked intake — `{decision, skeptic, context, sharpened_question}`. |
| `evidence_pool` | `jsonb` (array), default `[]` | Graded evidence cards (shape below). |
| `arguments` | `jsonb` (array), default `[]` | Argument buckets — `[{key, label, card_ids[]}]`. |
| `sections` | `jsonb` | Connective sections, filled at assemble — `{position, steelman, gaps, bottom_line}`. |
| `created_at` | `timestamptz` default `now()` | Creation time. |
| `updated_at` | `timestamptz` default `now()` | Last touch (drives the "My Cases" list order; engine sets on every write). |

**JSONB shapes (the contract research-017/018/019 share):**

```jsonc
commission:   { "decision": "...", "skeptic": "...", "context": "...",
                "sharpened_question": "..." }

// evidence_pool — array of graded evidence cards
evidence_pool: [
  { "id": "research_card:842" | "card-uuid",   // stable id; references from arguments[].card_ids
    "claim": "the gradable assertion",
    "grade": "A",                               // Beacon A–V evidence scale
    "source": { "title": "...", "authors": ["..."], "url": "...",
                "type": "internal",             // "internal" (library) | "web" (Exa)
                "paper_id": 123 },              // present only when type = "internal"
    "supports_argument": "argument-slug",        // matches an arguments[].key
    "state": "pool" }                            // "pool" | "cased" | "discarded"
]

// arguments — ordered buckets the member curates into
arguments: [
  { "key": "argument-slug",
    "label": "Human label for the argument",
    "card_ids": ["research_card:842", "card-uuid"] }  // ordered; ref evidence_pool[].id
]

// sections — generated at ASSEMBLE from the curated (state="cased") set ONLY
sections:     { "position": "...", "steelman": "...", "gaps": "...",
                "bottom_line": "..." }
```

Member-supplied data points ("add my own data point") are evidence cards with
`source.type` web-distinct handling left to the engine — they carry no citation
(`source.url` may be empty) and the engine tags them accordingly. Assemble cites
only cards in `state: "cased"` (no-fabrication).

### Design rationale (raw table vs Payload collection)

`beacon_cases` is a raw table outside Payload because: (1) the case is a
high-churn working document with deeply nested, variable-shape JSONB (evidence
cards, argument buckets, generated sections) that does not fit Payload's flat
field/relationship model and would risk schema drift; (2) its lifecycle
(commission → evidence → curate → assemble → export) is driven entirely by the
`/api/beacon/*` engine, not the admin UI; (3) the only Payload coupling is the
owning member, enforced by a plain FK to `members(id)` so a deleted member's
cases cascade away.

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
