-- =============================================================================
-- Beacon Case Canvas — `beacon_cases` persistence root (research-016 / WFM-90)
-- =============================================================================
-- DEPENDENCY ROOT for the Beacon Case Canvas program (research-016 … 019).
-- Spec: wfmlabs-fleet-research/01-source/BEACON-CASE-CANVAS.md
--
-- One row per CASE per MEMBER. A case is the analyst-workbench replacement for
-- the old chat-dump brief: the member commissions a question, Beacon fills an
-- evidence pool of graded cards (from `research_cards` kNN + Exa web-reach),
-- the member curates the strong cards into "The Case", and Beacon assembles
-- discrete connective sections that export to a one-pager / PDF / Markdown.
--
-- DESIGN: a raw table OUTSIDE Payload (exactly like `research_cards` /
-- `paper_chunks`), because:
--   * The case is a working document with deeply nested, variable-shape JSONB
--     (evidence cards, argument buckets, generated sections) that does not fit
--     Payload's flat field/relationship model and would risk schema drift.
--   * It has an independent, high-churn lifecycle (commission → evidence →
--     curate → assemble → export) driven entirely by the /api/beacon/* engine
--     (research-017), not by the Payload admin UI.
--   * The only Payload-managed coupling is the owning member; we enforce that
--     with a plain FK to `members(id)` (Payload's integer serial PK) so a
--     deleted member's cases cascade away.
--
-- The JSONB shapes below are the CONTRACT that research-017 (engine),
-- research-018 (UI), and research-019 (export) all code against. They are
-- documented in schema/README.md — keep the two in sync.
--
-- FOREMAN applies this post-merge:
--     psql "$WFMLABS_HUB_DATABASE_URL" -f schema/003_beacon_cases.sql
-- NEVER run in-session, NEVER via Payload push. Fully idempotent (IF NOT EXISTS).
-- No existing table is modified by this migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- beacon_cases — analyst cases. A member has MANY (one row per case, saved &
-- listed via /api/beacon/cases). NO unique(member_id) — multiple cases is intended.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beacon_cases (
    id              BIGSERIAL PRIMARY KEY,

    -- Owning member (Payload `members` collection, integer serial PK). Every
    -- /api/beacon/* route ownership-checks against this. Cascade on member del.
    member_id       INTEGER NOT NULL
                      REFERENCES members(id) ON DELETE CASCADE,

    -- Human-facing case title (often derived from the sharpened question).
    title           TEXT,

    -- Workbench lifecycle:
    --   draft     — commissioned and/or evidence pool being built/curated.
    --   assembled — connective `sections` have been generated.
    --   exported  — a one-pager/PDF/Markdown has been produced.
    status          TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','assembled','exported')),

    -- Commission (locked intake). Shape:
    --   { "decision": "...", "skeptic": "...", "context": "...",
    --     "sharpened_question": "..." }
    commission      JSONB,

    -- Evidence pool — array of graded evidence cards. Each card:
    --   { "id": "card-uuid|research_card:<id>",
    --     "claim": "the gradable assertion",
    --     "grade": "A".."V",                      -- Beacon A–V evidence scale
    --     "source": { "title": "...", "authors": ["..."], "url": "...",
    --                 "type": "internal" | "web", "paper_id": 123 },  -- paper_id only when type=internal
    --     "supports_argument": "<argument bucket key>",
    --     "state": "pool" | "cased" | "discarded" }  -- curation state
    evidence_pool   JSONB DEFAULT '[]'::jsonb,

    -- Argument buckets — ordered grouping the member curates into. Array of:
    --   { "key": "argument-slug",
    --     "label": "Human label for the argument",
    --     "card_ids": ["<evidence card id>", ...] }  -- ordered, references evidence_pool[].id
    arguments       JSONB DEFAULT '[]'::jsonb,

    -- Connective sections, generated at ASSEMBLE from the CURATED set only
    -- (no-fabrication; cite only `cased` evidence). Shape:
    --   { "position": "...", "steelman": "...", "gaps": "...",
    --     "bottom_line": "..." }
    sections        JSONB,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookups by owner.
CREATE INDEX IF NOT EXISTS idx_beacon_cases_member_id
    ON beacon_cases (member_id);

-- "My Cases" listing — a member's cases, most-recently-touched first.
CREATE INDEX IF NOT EXISTS idx_beacon_cases_member_updated
    ON beacon_cases (member_id, updated_at DESC);

-- =============================================================================
-- End 003_beacon_cases.sql
-- =============================================================================
