-- WFM Labs Chat: Unified Schema Migration
-- Replaces prototype schema with production-grade unified chat
-- Date: 2026-05-20

-- =============================================
-- Channel registry
-- =============================================
CREATE TABLE IF NOT EXISTS chat_channels (
    id              BIGSERIAL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    channel_type    TEXT NOT NULL DEFAULT 'community',
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_type ON chat_channels(channel_type);

-- =============================================
-- Seed channels
-- =============================================
INSERT INTO chat_channels (slug, channel_type, name, description) VALUES
    ('general',         'community',    '#General',           'Main community conversation'),
    ('announcements',   'community',    '#Announcements',     'Official announcements'),
    ('weather-alerts',  'operational',  '#Weather Alerts',    'OVIX weather events and discussion'),
    ('tools-help',      'community',    '#Tools & Help',      'ROC tools, tips, and support'),
    ('north-america',   'regional',     '#North America',     'North America regional ops'),
    ('south-america',   'regional',     '#South America',     'South America regional ops'),
    ('emea',            'regional',     '#EMEA',              'EMEA regional ops'),
    ('apac',            'regional',     '#APAC',              'Asia Pacific regional ops'),
    ('australia-nz',    'regional',     '#Australia / NZ',    'Australia and NZ regional ops')
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- Add thread support + soft delete to chat_messages
-- =============================================
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS parent_id BIGINT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_fts ON chat_messages USING GIN(to_tsvector('english', body));

-- Upgrade ably_message_id to partial unique index for dedup
DROP INDEX IF EXISTS idx_chat_messages_ably_id;
DROP INDEX IF EXISTS chat_messages_ably_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_ably_id ON chat_messages(ably_message_id) WHERE ably_message_id IS NOT NULL;
