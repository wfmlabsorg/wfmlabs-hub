-- =============================================================================
-- paper_chunks 384 → 1024-d rebuild for bge-m3 (research-013 / WFM-87)
-- =============================================================================
-- Successor to schema/001_deep_research_db.sql §3, which documented (but did NOT
-- execute) this exact DDL. This migration performs the destructive switch from
-- MiniLM-384 to @cf/baai/bge-m3 (1024-d) and swaps the ANN index ivfflat → HNSW.
--
-- Target DB: WFMLABS_HUB_DATABASE_URL (Hub Neon). FOREMAN applies post-merge:
--     psql "$WFMLABS_HUB_DATABASE_URL" -f schema/002_paper_chunks_bge_m3_rebuild.sql
-- NEVER run in-session, NEVER via Payload push.
--
-- ⚠️ DESTRUCTIVE + SEQUENCED. `paper_chunks` currently holds 4,549 MiniLM-384
--    rows and **Beacon v2 is LIVE querying them**. pgvector cannot resize a
--    column in place while rows hold 384-d data, so the only path is TRUNCATE →
--    resize → re-embed. This EMPTIES paper_chunks; Beacon's vector path is dark
--    (keyword/BM25 fallback covers it) until the corpus is re-embedded AND
--    research-014 switches Beacon's QUERY embedding to bge-m3.
--
-- ── REQUIRED APPLY / RUN / DEPLOY ORDER (minimize the dark window) ──
--   1. Apply THIS migration (Hub DB).
--   2. Deploy the `paper-embed` worker (roc); GET /backfill?dry=1 → confirm 1024-d.
--   3. Run GET /backfill (cost-gated) until /health shows chunks + cards embedded.
--   4. Merge + deploy research-014 (Beacon query embedding → bge-m3, kNN over
--      cards + 1024-d chunks).
--   Run 1→3 back-to-back so Beacon spends the least time on keyword fallback.
--
-- IDEMPOTENT + RE-RUN-SAFE: the truncate+resize only fire when the column is not
-- already 1024-d, so re-running this after the backfill will NOT wipe the
-- re-embedded vectors. The index swap is always reconciled to HNSW.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Truncate + resize embedding → vector(1024), but ONLY if it isn't already.
--    pgvector stores the declared dimension in pg_attribute.atttypmod
--    (e.g. 384 today, 1024 after this runs; -1 if dimensionless). Guarding on it
--    makes the destructive step a no-op on an already-migrated DB.
DO $$
DECLARE
  cur_typmod integer;
BEGIN
  SELECT a.atttypmod INTO cur_typmod
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relname = 'paper_chunks'
     AND a.attname = 'embedding'
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND n.nspname = current_schema();

  IF cur_typmod IS NULL THEN
    RAISE NOTICE 'paper_chunks.embedding not found — nothing to rebuild.';
  ELSIF cur_typmod = 1024 THEN
    RAISE NOTICE 'paper_chunks.embedding already vector(1024) — skipping truncate/resize (preserving data).';
  ELSE
    RAISE NOTICE 'Rebuilding paper_chunks.embedding (typmod % -> 1024); truncating stale chunks.', cur_typmod;
    TRUNCATE TABLE paper_chunks;
    ALTER TABLE paper_chunks ALTER COLUMN embedding TYPE vector(1024);
  END IF;
END $$;

-- 2. Swap the ANN index ivfflat → HNSW (cosine). The old ivfflat index reuses
--    the name `idx_paper_chunks_embedding`, so a bare CREATE INDEX IF NOT EXISTS
--    would see the name and KEEP ivfflat — we must DROP first, then create HNSW.
DROP INDEX IF EXISTS idx_paper_chunks_embedding;
CREATE INDEX IF NOT EXISTS idx_paper_chunks_embedding
    ON paper_chunks USING hnsw (embedding vector_cosine_ops);

-- =============================================================================
-- End 002_paper_chunks_bge_m3_rebuild.sql
-- =============================================================================
