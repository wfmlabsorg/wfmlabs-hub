-- =============================================================================
-- Deep Research Database — schema foundation (research-010 / WFM-84)
-- =============================================================================
-- DEPENDENCY ROOT for the Deep Research Database program (research-010 … 015).
-- Spec: wfmlabs-fleet-research/01-source/DEEP-RESEARCH-DATABASE.md
--
-- This is the FIRST file in the hub repo's `schema/NNN_*.sql` raw-SQL migration
-- convention (mirrors the roc repo's `schema/` numbering). FOREMAN applies it
-- post-merge; it is NEVER run in-session. Fully idempotent (IF NOT EXISTS).
--
-- Scope of THIS migration:
--   1. Ensure the `vector` extension.
--   2. Add full-text provenance columns to `papers` (full_text already exists).
--   3. Create `research_cards` — one structured deep card per paper, with a
--      card-level 1024-d bge-m3 embedding + an HNSW (cosine) index.
--   4. Document (but do NOT execute) the paper_chunks 384→1024-d rebuild path
--      that research-013 will perform — no destructive change here.
-- =============================================================================

-- pgvector (already present in prod at v0.8.0; idempotent for fresh setups).
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1. papers — full-text provenance
-- -----------------------------------------------------------------------------
-- `papers.full_text` already exists (Payload field `fullText`). research-011
-- writes these two provenance columns during full-text acquisition/backfill.
-- They are also declared as Payload fields (Papers.ts: fullTextSource /
-- fullTextStatus) so Payload's schema model matches the DB and no drift occurs.
ALTER TABLE papers ADD COLUMN IF NOT EXISTS full_text_source TEXT;
-- Where full_text was obtained: arxiv | unpaywall | crossref | web | manual.

ALTER TABLE papers ADD COLUMN IF NOT EXISTS full_text_status TEXT;
-- Acquisition lifecycle: pending | acquired | failed | unavailable.

-- -----------------------------------------------------------------------------
-- 2. research_cards — the core new asset (one deep card per paper)
-- -----------------------------------------------------------------------------
-- DESIGN: dedicated table (1:1 with papers), NOT a JSONB column on papers.
-- Rationale (see PR description for full justification):
--   * The card needs its own pgvector embedding + HNSW index for card-first
--     kNN retrieval. Payload manages the `papers` table; a vector column +
--     ANN index does not fit Payload's schema model and would risk drift. A
--     raw table outside Payload (exactly like `paper_chunks`) keeps the whole
--     deep-research/vector concern decoupled from Payload migrations.
--   * Independent lifecycle: card_status / regeneration / re-embed without
--     rewriting (and re-indexing) large `papers` rows.
--   * Structured columns for the fields we filter/scan on (evidence_strength,
--     source_basis, card_status, problem_tags[]); JSONB for the genuinely
--     nested/variable arrays (method, key_findings, key_quotes,
--     applicable_questions) where per-element shape matters but we don't index
--     individual sub-fields. This is the hybrid the spec invites.
CREATE TABLE IF NOT EXISTS research_cards (
    id                      BIGSERIAL PRIMARY KEY,
    paper_id                INTEGER NOT NULL
                              REFERENCES papers(id) ON DELETE CASCADE,

    -- Central claim, 1–2 sentences.
    thesis                  TEXT,

    -- Study design + sample + setting, e.g.
    -- {"design":"RCT|observational|qualitative|framework|benchmark",
    --  "sample_n": 1200, "setting":"contact center / BPO / region ..."}
    method                  JSONB,

    -- Array of {finding, stat_or_quote, locator}.
    key_findings            JSONB,

    -- Beacon evidence scale, single letter A–V.
    evidence_strength       TEXT,
    evidence_justification  TEXT,

    -- Decisions/questions this paper bears on. text[] so we can GIN-index /
    -- filter (e.g. "CES validity", "FCR↔churn", "agent attrition").
    problem_tags            TEXT[],

    -- Generalizability / age / vendor-interest caveats.
    limitations             TEXT,

    -- Member questions this paper can help answer. text[] for filtering.
    applicable_questions    TEXT[],

    -- Array of {quote, locator} — verbatim, for no-fabrication grounding.
    key_quotes              JSONB,

    -- What the card was generated from.
    source_basis            TEXT
                              CHECK (source_basis IN ('full_text','abstract_only')),

    -- Provenance + lifecycle.
    card_model              TEXT,
    generated_at            TIMESTAMPTZ,
    card_status             TEXT NOT NULL DEFAULT 'pending'
                              CHECK (card_status IN
                                ('pending','generating','complete','failed','stale')),

    -- Card-level embedding for card-first retrieval (research-013 fills this).
    -- 1024-d for @cf/baai/bge-m3 (the program's upgrade from MiniLM-384).
    embedding               vector(1024),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One current card per paper (regeneration UPSERTs on this).
    CONSTRAINT research_cards_paper_id_key UNIQUE (paper_id)
);

CREATE INDEX IF NOT EXISTS idx_research_cards_paper_id
    ON research_cards (paper_id);
CREATE INDEX IF NOT EXISTS idx_research_cards_status
    ON research_cards (card_status);
CREATE INDEX IF NOT EXISTS idx_research_cards_problem_tags
    ON research_cards USING GIN (problem_tags);

-- HNSW (cosine) ANN index on the card embedding for kNN at 1,090+ scale.
-- Safe to build now: the column starts empty, so the index is a no-op until
-- research-013 populates embeddings (then the index covers them automatically).
CREATE INDEX IF NOT EXISTS idx_research_cards_embedding
    ON research_cards USING hnsw (embedding vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- 3. paper_chunks — 384→1024-d rebuild path (DOCUMENTED, NOT EXECUTED here)
-- -----------------------------------------------------------------------------
-- `paper_chunks.embedding` is currently vector(384) (MiniLM-384, 4,549 rows)
-- with an ivfflat cosine index `idx_paper_chunks_embedding (lists=20)`.
-- pgvector cannot change a column's dimension in place while rows hold 384-d
-- data, so we do NOT touch it here (acceptance: no destructive change in 010).
--
-- research-013 rebuilds chunks from full text and will, in its own migration,
-- run the equivalent of:
--
--     TRUNCATE paper_chunks;                       -- drop stale 384-d chunks
--     ALTER TABLE paper_chunks
--         ALTER COLUMN embedding TYPE vector(1024); -- safe once empty
--     DROP INDEX IF EXISTS idx_paper_chunks_embedding;
--     CREATE INDEX idx_paper_chunks_embedding
--         ON paper_chunks USING hnsw (embedding vector_cosine_ops);
--     -- then re-chunk + re-embed with @cf/baai/bge-m3 (1024-d).
--
-- Kept here as documentation only so the rebuild contract is unambiguous.

-- =============================================================================
-- End 001_deep_research_db.sql
-- =============================================================================
