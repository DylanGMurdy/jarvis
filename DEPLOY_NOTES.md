# War Room Debate System — Deploy Notes

**Built: April 17, 2026 — while Dylan was at lunch**
**Status: Backend complete, ready to deploy. Frontend polish comes next session.**

## What just got built

The War Room is no longer 21 parallel AI monologues. It's now a real executive team debate:

1. **Project Constraints** — before each War Room, Dylan sets budget, timeline, strategic role, time commitment, success criteria, and hard constraints. Every agent respects these.
2. **6-phase deploy flow** — Wave 1 (C-suite, sequential) → Wave 2 (17 agents, batched) → Conflict Detection → Round 1 Debate → Round 2 Debate → Reconciliation + Escalation
3. **JARVIS as moderator** — identifies 3-10 real conflicts, classifies each as tactical (team resolves) or strategic (Dylan decides), runs targeted debate rounds
4. **Approval Queue integration** — strategic conflicts auto-escalate as pending approvals
5. **Full audit trail** — every initial position, every debate round, every resolution stored in Supabase
6. **AI-native company framing** — every agent prompt reframed so agents know Dylan is the only human and all teammates are AI

Expected War Room cost per run: ~$3-5 in Anthropic API.
Expected time per run: 8-12 minutes.

---

## Deployment — 4 steps in order

### STEP 1 — Run the SQL migration on Supabase

1. Open https://supabase.com/dashboard/project/lopnhfslzhumztjoagpw/sql
2. Click "New query"
3. Open the file `jarvis-dashboard/migrations/war_room_debate_system.sql` from this repo
4. Copy its entire contents, paste into the SQL editor
5. Click Run (green button, bottom right)
6. You should see "Success. No rows returned."

This creates:
- `project_constraints` table
- `war_room_agent_positions` table
- `war_room_conflicts` table
- `war_room_debate_messages` table
- Adds columns to `war_room_sessions`, `project_notes`, `approval_queue`

All changes are idempotent — safe to re-run.

### STEP 2 — Pull the code on the droplet

**[DROPLET]**
```bash
cd /opt/jarvis/jarvis-dashboard && git pull
```

You should see ~6 files changed.

### STEP 3 — Rebuild

**[DROPLET]**
```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run build
```

Wait for the route table. Should complete cleanly.

### STEP 4 — Restart PM2

**[DROPLET]**
```bash
pm2 restart jarvis && pm2 status
```

---

## Testing — how to verify it works

### Test 1: Constraints can be set

**[MAC - Terminal]** Open a terminal on your Mac. Run:
```bash
curl -X POST http://64.23.199.166:3000/api/projects/YOUR_PROJECT_ID/constraints \
  -H "Content-Type: application/json" \
  -d '{
    "budget_tier": "bootstrap",
    "timeline": "90_days",
    "strategic_role": "core_business",
    "time_commitment": "2_5_hrs",
    "success_criteria": "$3K MRR by month 4",
    "hard_constraints": "No paid ads, no human hires"
  }'
```

Replace `YOUR_PROJECT_ID` with a real project ID (you can grab one from Supabase's `projects` table or from the URL when viewing a project in Jarvis — `/ideas/THE_ID`).

Should return `{ "data": { ... } }` with the saved constraints.

### Test 2: Verify constraint got saved

**[MAC - Supabase]** → Table Editor → `project_constraints` — you should see your row.

### Test 3: Run a War Room

**[MAC - browser]** Go to a project in Jarvis → War Room tab → Deploy War Room.

Watch it run 8-12 min. When it completes, check:

1. **Supabase `war_room_sessions`** — new row with `debate_status: "complete"` or `"awaiting_dylan_decision"`, non-zero `conflict_count`
2. **Supabase `war_room_agent_positions`** — 21 rows for round 0, plus additional rows for rounds 1 and 2 (for agents that participated in debates)
3. **Supabase `war_room_conflicts`** — 3-10 rows
4. **Supabase `war_room_debate_messages`** — the full back-and-forth log
5. **Supabase `approval_queue`** — if there were strategic conflicts, new pending rows

### Test 4: Persistence

Close the tab. Reopen. Navigate back to the War Room. Reports should load automatically — both for new sessions (via new endpoint) and old sessions (via notes fallback).

---

## What I did NOT build yet (for next session)

These are deliberate gaps — we talked about doing the UI polish in a later session:

- **Constraint setup form** — right now you set constraints via API call (Test 1 above). Frontend modal before "Deploy War Room" comes next session.
- **Debate thread viewer** — the debate messages are saved but not displayed in the UI yet. Currently the UI only shows the initial/final positions per agent, not the back-and-forth.
- **Pretty report rendering** — raw markdown is still shown. Next session: McKinsey-style PDF reports, embedded charts, light/dark toggle.
- **Agent-level visuals** — charts per agent (Recharts) and architecture diagrams (Mermaid) come with the report upgrade.
- **Approval queue UI** — strategic escalations are saved but need the approval queue UI to surface them properly.
- **Tool integrations** — agent `tools: []` arrays are stubs. Phase 8 wires in real tools (Gmail, Stripe, GitHub API, etc.).

---

## Files changed in this commit

**New files:**
- `migrations/war_room_debate_system.sql` — Supabase migration
- `src/lib/warRoomAgents.ts` — 21 agent definitions + company framing
- `src/app/api/projects/[id]/constraints/route.ts` — GET/POST project constraints
- `src/app/api/projects/[id]/war-room/sessions/[sessionId]/route.ts` — session detail endpoint

**Modified:**
- `src/app/api/projects/[id]/war-room/deploy/route.ts` — full rewrite (6 phases, debate system)
- `src/app/api/projects/[id]/war-room/sessions/route.ts` — added new columns to response
- `src/app/ideas/[id]/page.tsx` — auto-load uses new session-detail endpoint

---

## If something breaks

1. **Build fails on droplet**: usually a memory issue. Check `free -h` on the droplet — if swap is getting used heavily, wait or retry.
2. **SQL migration fails**: each statement has `IF NOT EXISTS` guards. If a specific line fails, copy just that line and investigate.
3. **War Room hangs mid-run**: check `pm2 logs jarvis --lines 100` for errors. Common culprit: Anthropic API rate limits (you're Tier 2, should be fine). The session row will be marked `status: "errored"` so you'll see it in Supabase.
4. **Reports still don't persist**: verify the new tables exist in Supabase. Then check `war_room_sessions` has rows — if yes, the save worked but the load endpoint may be failing. Check browser Network tab for `/api/projects/.../war-room/sessions/.../` calls.

---

## Summary for Dylan

**What you have now:** An AI executive team that debates instead of monologues. Every War Room produces not just 21 reports but a real reconciled plan, with strategic decisions flagged up to you.

**What's still raw:** The UI doesn't fully show the new richness yet. You'll see initial + final positions but won't see the debate messages displayed until next session.

**Your first test:** Pick a real business (LoanPilot? Window install? New affiliate project?), set its constraints via the API (or wait for the next UI session), then Deploy War Room. The output should be noticeably different — agents reference each other, conflicts get named, strategic calls get escalated to you.
