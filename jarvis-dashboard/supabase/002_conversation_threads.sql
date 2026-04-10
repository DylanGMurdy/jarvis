-- ═══════════════════════════════════════════════════════════════
-- Conversation Threads — Adds thread support for chat persistence
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_type text DEFAULT 'global';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title text DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Index for fast conversation listing
CREATE INDEX IF NOT EXISTS idx_conversations_type_updated
  ON conversations (conversation_type, updated_at DESC);

-- Backfill: mark existing project conversations
UPDATE conversations
SET conversation_type = 'project'
WHERE summary LIKE 'project:%' AND conversation_type = 'global';
