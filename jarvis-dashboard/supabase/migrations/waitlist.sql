create table if not exists waitlist (
  id text primary key,
  email text not null unique,
  created_at timestamptz default now()
);
