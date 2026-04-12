-- Upgrade project_tasks for kanban board
alter table project_tasks add column if not exists priority text default 'medium';
alter table project_tasks add column if not exists status text default 'todo';
alter table project_tasks add column if not exists due_date date;
alter table project_tasks add column if not exists source text default 'manual';

-- Backfill status from done flag for existing rows
update project_tasks set status = 'done' where done = true and (status is null or status = 'todo');
update project_tasks set status = 'todo' where done = false and status is null;
