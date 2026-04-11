CREATE TABLE IF NOT EXISTS approval_queue (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id),
  project_title text,
  action_type text not null,
  description text not null,
  payload jsonb,
  status text default 'pending',
  created_at timestamp with time zone default now()
);
