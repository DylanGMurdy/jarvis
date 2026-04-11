CREATE TABLE IF NOT EXISTS lindy_clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  setup_paid boolean default false,
  monthly_active boolean default false,
  created_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS revenue_settings (
  key text primary key,
  value text not null
);
