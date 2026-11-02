alter table public.quotations
  add column if not exists project_overview text,
  add column if not exists scope_of_work text,
  add column if not exists tech_stack text,
  add column if not exists project_timeline text,
  add column if not exists support_and_maintenance text;
