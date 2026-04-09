-- Run this in your Supabase SQL editor when you're ready to migrate from localStorage

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  done boolean default false,
  created_at timestamptz default now()
);

create table if not exists project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade,
  entry text not null,
  created_at timestamptz default now()
);

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  tags jsonb default '[]',
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table projects enable row level security;
alter table project_tasks enable row level security;
alter table project_notes enable row level security;
alter table goals enable row level security;
alter table goal_journal enable row level security;
alter table memories enable row level security;

-- Allow all access with anon key (single user app)
create policy "Allow all" on projects for all using (true) with check (true);
create policy "Allow all" on project_tasks for all using (true) with check (true);
create policy "Allow all" on project_notes for all using (true) with check (true);
create policy "Allow all" on goals for all using (true) with check (true);
create policy "Allow all" on goal_journal for all using (true) with check (true);
create policy "Allow all" on memories for all using (true) with check (true);
