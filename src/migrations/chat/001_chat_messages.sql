CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  sender_id INTEGER,
  sender_username TEXT NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'human',
  sender_display_name TEXT,
  message_type TEXT DEFAULT 'text',
  body TEXT NOT NULL,
  metadata JSONB,
  ably_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_username);
CREATE INDEX IF NOT EXISTS idx_chat_messages_ably_id ON chat_messages(ably_message_id);
