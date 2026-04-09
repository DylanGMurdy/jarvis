import { getSupabase } from "@/lib/supabase";

// Runs the schema fix + seed by executing each statement via the Supabase client's rpc,
// or by using direct REST calls for DDL when rpc isn't available.
// Since Supabase JS client can't run raw DDL, we use the PostgREST-compatible approach:
// drop tables via REST, then recreate by inserting seed data into fresh tables.

// Actually: we'll use the Supabase Management API (requires service role or the project's
// postgres connection). Since we only have the anon key, we'll take a different approach:
// Use the supabase-js client to call an rpc function, OR just use the REST API directly
// to drop and recreate.

// The cleanest approach with only anon key access: hit the Supabase SQL endpoint directly.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function execSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  // Try the pg-meta SQL execution endpoint (available on all Supabase projects)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) return { ok: true };

  // If rpc doesn't exist, try the raw SQL endpoint (requires service role)
  const res2 = await fetch(`${SUPABASE_URL}/pg`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res2.ok) return { ok: true };

  return { ok: false, error: `SQL execution not available. Status: ${res.status}/${res2.status}` };
}

export async function POST() {
  const sb = getSupabase();
  if (!sb) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const steps: { step: string; status: string }[] = [];

  // Step 1: Try to drop old tables and create new ones via raw SQL
  const dropAndCreate = `
    drop table if exists project_notes cascade;
    drop table if exists project_tasks cascade;
    drop table if exists goal_journal cascade;
    drop table if exists goals cascade;
    drop table if exists projects cascade;
    drop table if exists memories cascade;
    drop table if exists conversations cascade;
    drop table if exists lindy_updates cascade;

    create table projects (
      id text primary key,
      title text not null,
      category text not null,
      status text not null default 'Idea',
      description text default '',
      revenue_goal text default '',
      progress integer default 0,
      grade text not null default 'B',
      created_at timestamptz default now()
    );

    create table project_tasks (
      id text primary key,
      project_id text references projects(id) on delete cascade,
      title text not null,
      done boolean default false,
      created_at timestamptz default now()
    );

    create table project_notes (
      id text primary key,
      project_id text references projects(id) on delete cascade,
      content text not null,
      created_at timestamptz default now()
    );

    create table goals (
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

    create table goal_journal (
      id text primary key,
      goal_id text references goals(id) on delete cascade,
      entry text not null,
      created_at timestamptz default now()
    );

    create table memories (
      id uuid primary key default gen_random_uuid(),
      fact text not null,
      category text not null default 'personal',
      source text not null default 'chat',
      confidence real not null default 0.8,
      created_at timestamptz default now()
    );

    create table conversations (
      id uuid primary key default gen_random_uuid(),
      messages jsonb not null default '[]',
      summary text default '',
      created_at timestamptz default now()
    );

    create table lindy_updates (
      id uuid primary key default gen_random_uuid(),
      summary text not null default '',
      emails_handled integer default 0,
      tasks_completed integer default 0,
      flags jsonb default '[]',
      raw_payload jsonb default '{}',
      created_at timestamptz default now()
    );

    alter table projects enable row level security;
    alter table project_tasks enable row level security;
    alter table project_notes enable row level security;
    alter table goals enable row level security;
    alter table goal_journal enable row level security;
    alter table memories enable row level security;
    alter table conversations enable row level security;
    alter table lindy_updates enable row level security;

    create policy "Allow all" on projects for all using (true) with check (true);
    create policy "Allow all" on project_tasks for all using (true) with check (true);
    create policy "Allow all" on project_notes for all using (true) with check (true);
    create policy "Allow all" on goals for all using (true) with check (true);
    create policy "Allow all" on goal_journal for all using (true) with check (true);
    create policy "Allow all" on memories for all using (true) with check (true);
    create policy "Allow all" on conversations for all using (true) with check (true);
    create policy "Allow all" on lindy_updates for all using (true) with check (true);
  `;

  const sqlResult = await execSQL(dropAndCreate);
  if (sqlResult.ok) {
    steps.push({ step: "DDL via SQL", status: "ok" });
  } else {
    steps.push({ step: "DDL via SQL", status: `failed: ${sqlResult.error}` });

    // Fallback: try to delete all rows from existing tables and re-insert
    // This won't fix column types but at least seeds data
    steps.push({ step: "Fallback: clearing existing data", status: "attempting..." });

    // Delete everything from tables (order matters for FK)
    for (const table of ["project_notes", "project_tasks", "goal_journal", "goals", "projects", "memories", "conversations", "lindy_updates"]) {
      const { error } = await sb.from(table).delete().neq("id", "___never_match___");
      steps.push({ step: `Clear ${table}`, status: error ? `error: ${error.message}` : "ok" });
    }
  }

  // Step 2: Seed data via Supabase client
  const projects = [
    { id: "proj-1", title: "AI Real Estate Lead Nurture", category: "AI Business", status: "Planning", description: "Automated lead follow-up system for new construction builders. Integrates with CRM, sends personalized follow-ups based on buyer behavior and timeline. Target Utah builders first, then expand nationally.", revenue_goal: "$2-5k/mo per builder client", progress: 15, grade: "A", created_at: "2026-03-15T00:00:00Z" },
    { id: "proj-2", title: "Jarvis-as-a-Service", category: "AI Business", status: "Building", description: "Productize this dashboard as a SaaS for entrepreneurs. Personal AI chief of staff with customizable agents, goal tracking, and AI chat. $99-299/mo subscription model.", revenue_goal: "$5-30k/mo at scale", progress: 30, grade: "A", created_at: "2026-03-20T00:00:00Z" },
    { id: "proj-3", title: "AI Home Buyer Chatbot", category: "Real Estate", status: "Idea", description: "24/7 chatbot for builder websites that qualifies leads, answers FAQs about communities, and books showings. White-label for multiple builders.", revenue_goal: "$500-1k/mo per builder", progress: 0, grade: "B", created_at: "2026-03-25T00:00:00Z" },
    { id: "proj-4", title: "Narwhal Ops Automation", category: "Real Estate", status: "Planning", description: "Automate internal Narwhal Homes operations — lead routing, transaction coordination, reporting, and client communication. Reduce manual work by 50%.", revenue_goal: "Internal efficiency — saves 10+ hrs/week", progress: 20, grade: "B", created_at: "2026-03-28T00:00:00Z" },
    { id: "proj-5", title: "AI Listing Content Generator", category: "Real Estate", status: "Idea", description: "Generate MLS descriptions, social media posts, and virtual tour scripts from listing photos and details. Tool for agents.", revenue_goal: "$29-99/mo per agent", progress: 0, grade: "C", created_at: "2026-04-01T00:00:00Z" },
    { id: "proj-6", title: "Football Film Platform", category: "AI Business", status: "Planning", description: "AI-powered football film analysis platform. Automated game film breakdown, player tracking, and coaching insights. Target high school and college programs.", revenue_goal: "$3-10k/mo per program", progress: 10, grade: "A", created_at: "2026-04-05T00:00:00Z" },
    { id: "proj-7", title: "Narwhal Real Estate", category: "Real Estate", status: "Building", description: "Core real estate operations at Narwhal Homes / Red Rock Real Estate. New construction focus, builder relationships, lead management. Powered by Lindy AI for automation.", revenue_goal: "Primary income — commissions", progress: 75, grade: "A", created_at: "2026-01-01T00:00:00Z" },
  ];

  const { error: pe } = await sb.from("projects").upsert(projects, { onConflict: "id" });
  steps.push({ step: "Seed projects", status: pe ? `error: ${pe.message}` : "7 projects seeded" });

  if (!pe) {
    const tasks = [
      { id: "pt-1", project_id: "proj-1", title: "Define MVP feature set", done: true, created_at: "2026-03-15T00:00:00Z" },
      { id: "pt-2", project_id: "proj-1", title: "Design email sequence templates", done: false, created_at: "2026-03-16T00:00:00Z" },
      { id: "pt-3", project_id: "proj-1", title: "Build CRM webhook integration", done: false, created_at: "2026-03-17T00:00:00Z" },
      { id: "pt-4", project_id: "proj-1", title: "Get 2 beta builder clients", done: false, created_at: "2026-03-18T00:00:00Z" },
      { id: "pt-5", project_id: "proj-2", title: "Build dashboard shell", done: true, created_at: "2026-03-20T00:00:00Z" },
      { id: "pt-6", project_id: "proj-2", title: "Add Anthropic chat integration", done: true, created_at: "2026-03-21T00:00:00Z" },
      { id: "pt-7", project_id: "proj-2", title: "Build project management system", done: false, created_at: "2026-03-22T00:00:00Z" },
      { id: "pt-8", project_id: "proj-2", title: "Create waitlist landing page", done: false, created_at: "2026-03-23T00:00:00Z" },
      { id: "pt-9", project_id: "proj-4", title: "Map current manual workflows", done: true, created_at: "2026-03-28T00:00:00Z" },
      { id: "pt-10", project_id: "proj-4", title: "Set up Inbox Sentinel agent", done: false, created_at: "2026-03-29T00:00:00Z" },
    ];
    const { error: te } = await sb.from("project_tasks").upsert(tasks, { onConflict: "id" });
    steps.push({ step: "Seed tasks", status: te ? `error: ${te.message}` : "10 tasks seeded" });
  }

  const goals = [
    { id: "goal-1", title: "Launch 1 AI product with real revenue", category: "Product", progress: 5, target: "Ship MVP and get first paying customer", target_date: "2026-07-08", milestones: [{ id: "m1", title: "Choose product to build first", done: true },{ id: "m2", title: "Define MVP scope and features", done: false },{ id: "m3", title: "Build working prototype", done: false },{ id: "m4", title: "Get 2 beta users", done: false },{ id: "m5", title: "Iterate based on feedback", done: false },{ id: "m6", title: "Launch publicly", done: false },{ id: "m7", title: "Get first paying customer", done: false }], weekly_breakdown: ["Weeks 1-2: Finalize scope, design system architecture","Weeks 3-4: Build core MVP — email sequences + CRM hooks","Weeks 5-6: Beta test with 2 builder contacts","Weeks 7-8: Iterate, fix bugs, add polish","Weeks 9-10: Launch, onboard first paid clients","Weeks 11-12: Optimize, collect testimonials, plan growth"], progress_snapshots: [{ week: 1, progress: 3, date: "2026-04-01" },{ week: 2, progress: 5, date: "2026-04-08" }], created_at: "2026-03-15T00:00:00Z" },
    { id: "goal-2", title: "Master AI build tools", category: "Skills", progress: 15, target: "Proficiency in Claude API, Next.js, and agent architecture", target_date: "2026-07-08", milestones: [{ id: "m8", title: "Complete Claude API tutorial projects", done: true },{ id: "m9", title: "Build a full Next.js app (Jarvis)", done: true },{ id: "m10", title: "Implement prompt engineering best practices", done: false },{ id: "m11", title: "Build multi-agent orchestration system", done: false },{ id: "m12", title: "Deploy production AI application", done: false }], weekly_breakdown: ["Weeks 1-2: Deep dive Claude API — streaming, tools, system prompts","Weeks 3-4: Master Next.js App Router, API routes, server components","Weeks 5-6: Build agent architecture — multi-agent coordination","Weeks 7-8: Prompt engineering — testing, iteration, evaluation","Weeks 9-10: Production deployment — monitoring, error handling","Weeks 11-12: Advanced patterns — RAG, function calling, chains"], progress_snapshots: [{ week: 1, progress: 8, date: "2026-04-01" },{ week: 2, progress: 15, date: "2026-04-08" }], created_at: "2026-03-15T00:00:00Z" },
    { id: "goal-3", title: "Generate $1k/mo from AI", category: "Revenue", progress: 0, target: "Recurring monthly revenue from AI products/services", target_date: "2026-07-08", milestones: [{ id: "m13", title: "Launch first paid product", done: false },{ id: "m14", title: "Get first paying customer", done: false },{ id: "m15", title: "Reach $250/mo", done: false },{ id: "m16", title: "Reach $500/mo", done: false },{ id: "m17", title: "Reach $1,000/mo", done: false }], weekly_breakdown: ["Weeks 1-4: Focus on building — revenue comes from shipped products","Weeks 5-6: Beta launch, initial outreach to builder network","Weeks 7-8: Convert beta users to paid ($500/mo each)","Weeks 9-10: Add 2nd client, refine pricing","Weeks 11-12: Hit $1k/mo target, systemize sales process"], progress_snapshots: [{ week: 1, progress: 0, date: "2026-04-01" },{ week: 2, progress: 0, date: "2026-04-08" }], created_at: "2026-03-15T00:00:00Z" },
    { id: "goal-4", title: "Automate Narwhal ops with AI", category: "Operations", progress: 20, target: "Reduce manual work by 50% using AI agents", target_date: "2026-07-08", milestones: [{ id: "m18", title: "Map all manual workflows", done: true },{ id: "m19", title: "Deploy Inbox Sentinel", done: true },{ id: "m20", title: "Automate lead follow-up sequences", done: false },{ id: "m21", title: "Automate transaction coordination", done: false },{ id: "m22", title: "Automate weekly reporting", done: false },{ id: "m23", title: "Measure time saved — hit 50% target", done: false }], weekly_breakdown: ["Weeks 1-2: Deploy and tune Inbox Sentinel","Weeks 3-4: Build automated lead follow-up sequences","Weeks 5-6: Automate transaction coordination workflows","Weeks 7-8: Build automated reporting dashboard","Weeks 9-10: Test and iterate on all automations","Weeks 11-12: Measure results, optimize, document SOPs"], progress_snapshots: [{ week: 1, progress: 12, date: "2026-04-01" },{ week: 2, progress: 20, date: "2026-04-08" }], created_at: "2026-03-15T00:00:00Z" },
  ];

  const { error: ge } = await sb.from("goals").upsert(goals, { onConflict: "id" });
  steps.push({ step: "Seed goals", status: ge ? `error: ${ge.message}` : "4 goals seeded" });

  // Verify
  const { data: projectCount } = await sb.from("projects").select("id", { count: "exact", head: true });
  const { data: goalCount } = await sb.from("goals").select("id", { count: "exact", head: true });

  return Response.json({
    steps,
    verification: {
      projects: projectCount,
      goals: goalCount,
    },
  });
}
