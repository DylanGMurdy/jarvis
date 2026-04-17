-- ═══════════════════════════════════════════════════════════════════
-- Jarvis War Room — Debate System Migration
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/lopnhfslzhumztjoagpw/sql)
-- Safe to run multiple times (uses IF NOT EXISTS guards)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Per-project constraints (so they persist across War Rooms) ──
CREATE TABLE IF NOT EXISTS project_constraints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  budget_tier TEXT,                 -- "bootstrap" | "under_5k" | "5k_25k" | "25k_100k" | "seeking_funding"
  timeline TEXT,                    -- "30_days" | "90_days" | "6_months" | "12_months" | "18_24_months"
  strategic_role TEXT,              -- "quick_cash_grab" | "pipeline_funder" | "core_business" | "moonshot" | "passion_project"
  time_commitment TEXT,             -- "0_2_hrs" | "2_5_hrs" | "5_15_hrs" | "15_plus_hrs"
  success_criteria TEXT,
  hard_constraints TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_constraints_project ON project_constraints(project_id);
ALTER TABLE project_constraints DISABLE ROW LEVEL SECURITY;

-- ── 2. Upgrade war_room_sessions with constraint snapshot + debate status ──
ALTER TABLE war_room_sessions
  ADD COLUMN IF NOT EXISTS constraints_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS debate_status TEXT DEFAULT 'not_started',
  -- values: not_started | wave_1_running | wave_2_running | detecting_conflicts
  --         round_1_debating | round_2_debating | reconciling | complete | awaiting_dylan_decision
  ADD COLUMN IF NOT EXISTS escalation_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rounds_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conflict_count INT DEFAULT 0;

-- ── 3. Agent positions per round (the core of the debate system) ──
CREATE TABLE IF NOT EXISTS war_room_agent_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES war_room_sessions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,          -- "cfo", "cto", "cmo", etc.
  agent_name TEXT NOT NULL,         -- "CFO", "Chief Technology Officer"
  agent_tier TEXT NOT NULL,         -- "c-suite" | "vp" | "specialist"
  round INT NOT NULL,               -- 0=initial, 1=round 1 debate, 2=round 2 debate, 3=final reconciled
  position_text TEXT,               -- Prose output
  position_data JSONB,              -- Structured: { budget, timeline, recommendations, risks, dependencies }
  references_positions UUID[],      -- Other position IDs this one reacts to
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_session ON war_room_agent_positions(session_id, round);
CREATE INDEX IF NOT EXISTS idx_positions_agent ON war_room_agent_positions(session_id, agent_key);
ALTER TABLE war_room_agent_positions DISABLE ROW LEVEL SECURITY;

-- ── 4. Identified conflicts between agents ──
CREATE TABLE IF NOT EXISTS war_room_conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES war_room_sessions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conflict_topic TEXT NOT NULL,     -- "Pricing: $99 vs $199"
  conflict_description TEXT,        -- Full explanation
  agents_involved TEXT[] NOT NULL,  -- ["cfo", "cmo", "vp_sales"]
  conflict_type TEXT NOT NULL,      -- "tactical" (Jarvis resolves) | "strategic" (escalate to Dylan)
  conflict_category TEXT,           -- "budget" | "pricing" | "timeline" | "legal" | "scope" | "strategy"
  resolution_status TEXT DEFAULT 'open',   -- "open" | "resolving" | "resolved" | "escalated"
  resolution_text TEXT,
  resolved_in_round INT,            -- NULL until resolved, then 1, 2, or 3 (final)
  escalated_to_dylan BOOLEAN DEFAULT FALSE,
  approval_queue_id UUID,           -- If escalated, link to approval_queue row
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conflicts_session ON war_room_conflicts(session_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON war_room_conflicts(session_id, resolution_status);
ALTER TABLE war_room_conflicts DISABLE ROW LEVEL SECURITY;

-- ── 5. Full debate audit log (agent-to-agent messages) ──
CREATE TABLE IF NOT EXISTS war_room_debate_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES war_room_sessions(id) ON DELETE CASCADE,
  conflict_id UUID REFERENCES war_room_conflicts(id) ON DELETE SET NULL,
  round INT NOT NULL,
  from_agent TEXT NOT NULL,         -- "jarvis" | agent key
  to_agents TEXT[],                 -- ["cfo", "cto"] | NULL for broadcasts
  message_type TEXT NOT NULL,       -- "question" | "response" | "acknowledge" | "challenge" | "concede" | "summary"
  message TEXT NOT NULL,
  referenced_conflict_topic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debate_session ON war_room_debate_messages(session_id, round, created_at);
CREATE INDEX IF NOT EXISTS idx_debate_conflict ON war_room_debate_messages(conflict_id, created_at);
ALTER TABLE war_room_debate_messages DISABLE ROW LEVEL SECURITY;

-- ── 6. Ensure project_notes has source column (idempotent) ──
ALTER TABLE project_notes
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID;

CREATE INDEX IF NOT EXISTS idx_project_notes_source ON project_notes(project_id, source);
CREATE INDEX IF NOT EXISTS idx_project_notes_session ON project_notes(session_id);

-- ── 7. Ensure approval_queue has the columns we need for escalation ──
-- (Table already exists per your schema list, just confirm columns)
ALTER TABLE approval_queue
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS context JSONB;

-- ═══════════════════════════════════════════════════════════════════
-- Done. Verify by running:
--   SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'war_room%';
-- You should see: war_room_sessions, war_room_agent_positions, war_room_conflicts, war_room_debate_messages
-- ═══════════════════════════════════════════════════════════════════
