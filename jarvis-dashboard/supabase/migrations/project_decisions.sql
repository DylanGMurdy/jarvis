CREATE TABLE IF NOT EXISTS project_decisions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id),
  decision text not null,
  created_at timestamp with time zone default now()
);
