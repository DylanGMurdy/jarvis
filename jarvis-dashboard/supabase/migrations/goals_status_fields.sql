-- Add missing columns to goals table for 90-day tracker
alter table goals add column if not exists description text default '';
alter table goals add column if not exists status text default 'On Track';
alter table goals add column if not exists project_id text;
