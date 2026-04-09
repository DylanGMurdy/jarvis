-- ═══════════════════════════════════════════════════════════════
-- JARVIS Dashboard — Full Supabase Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- ─── Projects ────────────────────────────────────────────────
create table if not exists projects (
  id text primary key,
  title text not null,
  category text not null check (category in ('AI Business', 'Real Estate', 'Side Hustles', 'Personal')),
  status text not null default 'Idea' check (status in ('Idea', 'Planning', 'Building', 'Launched', 'Revenue')),
  description text default '',
  revenue_goal text default '',
  progress integer default 0,
  grade text not null default 'B' check (grade in ('A', 'B', 'C')),
  created_at timestamptz default now()
);

create table if not exists project_tasks (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  title text not null,
  done boolean default false,
  created_at timestamptz default now()
);

create table if not exists project_notes (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- ─── Goals ───────────────────────────────────────────────────
create table if not exists goals (
  id text primary key,
  title text not null,
  category text default '',
  progress integer default 0,
  target text default '',
  target_date text default '',
  milestones jsonb default '[]',
  weekly_breakdown jsonb default '[]',
  progress_snapshots jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists goal_journal (
  id text primary key,
  goal_id text references goals(id) on delete cascade,
  entry text not null,
  created_at timestamptz default now()
);

-- ─── Memories ────────────────────────────────────────────────
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  fact text not null,
  category text not null default 'personal'
    check (category in ('personal', 'business', 'health', 'goals', 'relationships', 'preferences', 'ideas')),
  source text not null default 'chat',
  confidence real not null default 0.8,
  created_at timestamptz default now()
);

-- ─── Conversations ───────────────────────────────────────────
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  messages jsonb not null default '[]',
  summary text default '',
  created_at timestamptz default now()
);

-- ─── Lindy Updates ───────────────────────────────────────────
create table if not exists lindy_updates (
  id uuid primary key default gen_random_uuid(),
  summary text not null default '',
  emails_handled integer default 0,
  tasks_completed integer default 0,
  flags jsonb default '[]',
  raw_payload jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────
alter table projects enable row level security;
alter table project_tasks enable row level security;
alter table project_notes enable row level security;
alter table goals enable row level security;
alter table goal_journal enable row level security;
alter table memories enable row level security;
alter table conversations enable row level security;
alter table lindy_updates enable row level security;

-- Allow all (single-user app with anon key)
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'projects','project_tasks','project_notes',
    'goals','goal_journal',
    'memories','conversations','lindy_updates'
  ]) loop
    execute format(
      'create policy if not exists "Allow all" on %I for all using (true) with check (true)', t
    );
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — Only insert if tables are empty
-- ═══════════════════════════════════════════════════════════════

-- Seed Projects
insert into projects (id, title, category, status, description, revenue_goal, progress, grade, created_at)
select * from (values
  ('proj-1', 'AI Real Estate Lead Nurture', 'AI Business', 'Planning',
   'Automated lead follow-up system for new construction builders. Integrates with CRM, sends personalized follow-ups based on buyer behavior and timeline. Target Utah builders first, then expand nationally.',
   '$2-5k/mo per builder client', 15, 'A', '2026-03-15T00:00:00Z'::timestamptz),
  ('proj-2', 'Jarvis-as-a-Service', 'AI Business', 'Building',
   'Productize this dashboard as a SaaS for entrepreneurs. Personal AI chief of staff with customizable agents, goal tracking, and AI chat. $99-299/mo subscription model.',
   '$5-30k/mo at scale', 30, 'A', '2026-03-20T00:00:00Z'::timestamptz),
  ('proj-3', 'AI Home Buyer Chatbot', 'Real Estate', 'Idea',
   '24/7 chatbot for builder websites that qualifies leads, answers FAQs about communities, and books showings. White-label for multiple builders.',
   '$500-1k/mo per builder', 0, 'B', '2026-03-25T00:00:00Z'::timestamptz),
  ('proj-4', 'Narwhal Ops Automation', 'Real Estate', 'Planning',
   'Automate internal Narwhal Homes operations — lead routing, transaction coordination, reporting, and client communication. Reduce manual work by 50%.',
   'Internal efficiency — saves 10+ hrs/week', 20, 'B', '2026-03-28T00:00:00Z'::timestamptz),
  ('proj-5', 'AI Listing Content Generator', 'Real Estate', 'Idea',
   'Generate MLS descriptions, social media posts, and virtual tour scripts from listing photos and details. Tool for agents.',
   '$29-99/mo per agent', 0, 'C', '2026-04-01T00:00:00Z'::timestamptz),
  ('proj-6', 'Football Film Platform', 'AI Business', 'Planning',
   'AI-powered football film analysis platform. Automated game film breakdown, player tracking, and coaching insights. Target high school and college programs.',
   '$3-10k/mo per program', 10, 'A', '2026-04-05T00:00:00Z'::timestamptz),
  ('proj-7', 'Narwhal Real Estate', 'Real Estate', 'Building',
   'Core real estate operations at Narwhal Homes / Red Rock Real Estate. New construction focus, builder relationships, lead management. Powered by Lindy AI for automation.',
   'Primary income — commissions', 75, 'A', '2026-01-01T00:00:00Z'::timestamptz)
) as v(id, title, category, status, description, revenue_goal, progress, grade, created_at)
where not exists (select 1 from projects limit 1);

-- Seed Project Tasks
insert into project_tasks (id, project_id, title, done, created_at)
select * from (values
  ('pt-1', 'proj-1', 'Define MVP feature set', true, '2026-03-15T00:00:00Z'::timestamptz),
  ('pt-2', 'proj-1', 'Design email sequence templates', false, '2026-03-16T00:00:00Z'::timestamptz),
  ('pt-3', 'proj-1', 'Build CRM webhook integration', false, '2026-03-17T00:00:00Z'::timestamptz),
  ('pt-4', 'proj-1', 'Get 2 beta builder clients', false, '2026-03-18T00:00:00Z'::timestamptz),
  ('pt-5', 'proj-2', 'Build dashboard shell', true, '2026-03-20T00:00:00Z'::timestamptz),
  ('pt-6', 'proj-2', 'Add Anthropic chat integration', true, '2026-03-21T00:00:00Z'::timestamptz),
  ('pt-7', 'proj-2', 'Build project management system', false, '2026-03-22T00:00:00Z'::timestamptz),
  ('pt-8', 'proj-2', 'Create waitlist landing page', false, '2026-03-23T00:00:00Z'::timestamptz),
  ('pt-9', 'proj-4', 'Map current manual workflows', true, '2026-03-28T00:00:00Z'::timestamptz),
  ('pt-10', 'proj-4', 'Set up Inbox Sentinel agent', false, '2026-03-29T00:00:00Z'::timestamptz)
) as v(id, project_id, title, done, created_at)
where not exists (select 1 from project_tasks limit 1);

-- Seed Goals
insert into goals (id, title, category, progress, target, target_date, milestones, weekly_breakdown, progress_snapshots, created_at)
select * from (values
  ('goal-1', 'Launch 1 AI product with real revenue', 'Product', 5,
   'Ship MVP and get first paying customer', '2026-07-08',
   '[{"id":"m1","title":"Choose product to build first","done":true},{"id":"m2","title":"Define MVP scope and features","done":false},{"id":"m3","title":"Build working prototype","done":false},{"id":"m4","title":"Get 2 beta users","done":false},{"id":"m5","title":"Iterate based on feedback","done":false},{"id":"m6","title":"Launch publicly","done":false},{"id":"m7","title":"Get first paying customer","done":false}]'::jsonb,
   '["Weeks 1-2: Finalize scope, design system architecture","Weeks 3-4: Build core MVP — email sequences + CRM hooks","Weeks 5-6: Beta test with 2 builder contacts","Weeks 7-8: Iterate, fix bugs, add polish","Weeks 9-10: Launch, onboard first paid clients","Weeks 11-12: Optimize, collect testimonials, plan growth"]'::jsonb,
   '[{"week":1,"progress":3,"date":"2026-04-01"},{"week":2,"progress":5,"date":"2026-04-08"}]'::jsonb,
   '2026-03-15T00:00:00Z'::timestamptz),
  ('goal-2', 'Master AI build tools', 'Skills', 15,
   'Proficiency in Claude API, Next.js, and agent architecture', '2026-07-08',
   '[{"id":"m8","title":"Complete Claude API tutorial projects","done":true},{"id":"m9","title":"Build a full Next.js app (Jarvis)","done":true},{"id":"m10","title":"Implement prompt engineering best practices","done":false},{"id":"m11","title":"Build multi-agent orchestration system","done":false},{"id":"m12","title":"Deploy production AI application","done":false}]'::jsonb,
   '["Weeks 1-2: Deep dive Claude API — streaming, tools, system prompts","Weeks 3-4: Master Next.js App Router, API routes, server components","Weeks 5-6: Build agent architecture — multi-agent coordination","Weeks 7-8: Prompt engineering — testing, iteration, evaluation","Weeks 9-10: Production deployment — monitoring, error handling","Weeks 11-12: Advanced patterns — RAG, function calling, chains"]'::jsonb,
   '[{"week":1,"progress":8,"date":"2026-04-01"},{"week":2,"progress":15,"date":"2026-04-08"}]'::jsonb,
   '2026-03-15T00:00:00Z'::timestamptz),
  ('goal-3', 'Generate $1k/mo from AI', 'Revenue', 0,
   'Recurring monthly revenue from AI products/services', '2026-07-08',
   '[{"id":"m13","title":"Launch first paid product","done":false},{"id":"m14","title":"Get first paying customer","done":false},{"id":"m15","title":"Reach $250/mo","done":false},{"id":"m16","title":"Reach $500/mo","done":false},{"id":"m17","title":"Reach $1,000/mo","done":false}]'::jsonb,
   '["Weeks 1-4: Focus on building — revenue comes from shipped products","Weeks 5-6: Beta launch, initial outreach to builder network","Weeks 7-8: Convert beta users to paid ($500/mo each)","Weeks 9-10: Add 2nd client, refine pricing","Weeks 11-12: Hit $1k/mo target, systemize sales process"]'::jsonb,
   '[{"week":1,"progress":0,"date":"2026-04-01"},{"week":2,"progress":0,"date":"2026-04-08"}]'::jsonb,
   '2026-03-15T00:00:00Z'::timestamptz),
  ('goal-4', 'Automate Narwhal ops with AI', 'Operations', 20,
   'Reduce manual work by 50% using AI agents', '2026-07-08',
   '[{"id":"m18","title":"Map all manual workflows","done":true},{"id":"m19","title":"Deploy Inbox Sentinel","done":true},{"id":"m20","title":"Automate lead follow-up sequences","done":false},{"id":"m21","title":"Automate transaction coordination","done":false},{"id":"m22","title":"Automate weekly reporting","done":false},{"id":"m23","title":"Measure time saved — hit 50% target","done":false}]'::jsonb,
   '["Weeks 1-2: Deploy and tune Inbox Sentinel","Weeks 3-4: Build automated lead follow-up sequences","Weeks 5-6: Automate transaction coordination workflows","Weeks 7-8: Build automated reporting dashboard","Weeks 9-10: Test and iterate on all automations","Weeks 11-12: Measure results, optimize, document SOPs"]'::jsonb,
   '[{"week":1,"progress":12,"date":"2026-04-01"},{"week":2,"progress":20,"date":"2026-04-08"}]'::jsonb,
   '2026-03-15T00:00:00Z'::timestamptz)
) as v(id, title, category, progress, target, target_date, milestones, weekly_breakdown, progress_snapshots, created_at)
where not exists (select 1 from goals limit 1);
