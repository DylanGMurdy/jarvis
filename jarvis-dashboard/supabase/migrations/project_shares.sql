create table if not exists project_shares (
  token text primary key,
  project_id text not null references projects(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_project_shares_project on project_shares(project_id);
