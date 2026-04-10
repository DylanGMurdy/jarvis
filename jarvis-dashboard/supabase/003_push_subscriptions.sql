-- ═══════════════════════════════════════════════════════════════
-- Push Subscriptions — Web Push notification support
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Single-user app — allow all
CREATE POLICY "Allow all push_subscriptions" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);
