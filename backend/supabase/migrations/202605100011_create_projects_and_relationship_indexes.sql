create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_code text unique not null,
  project_name text not null,
  project_type text,
  description text,
  status text default 'lead' check (status in ('lead', 'discovery', 'proposal', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled', 'maintenance')),
  start_date date,
  target_end_date date,
  actual_end_date date,
  project_value numeric default 0,
  assigned_manager uuid references public.profiles(id),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  tags text[],
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop policy if exists "Authenticated users can read projects" on public.projects;
create policy "Authenticated users can read projects" on public.projects for select to authenticated using (true);
drop policy if exists "Authenticated users can insert projects" on public.projects;
create policy "Authenticated users can insert projects" on public.projects for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "Authenticated users can update projects" on public.projects;
create policy "Authenticated users can update projects" on public.projects for update to authenticated using (true) with check (true);
drop policy if exists "Admins can delete projects" on public.projects;
create policy "Admins can delete projects" on public.projects for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

alter table public.quotations add column if not exists project_id uuid references public.projects(id), add column if not exists version_number integer default 1, add column if not exists parent_quotation_id uuid references public.quotations(id), add column if not exists approved_at timestamptz, add column if not exists sent_at timestamptz, add column if not exists rejected_reason text;
alter table public.contracts add column if not exists project_id uuid references public.projects(id), add column if not exists version_number integer default 1, add column if not exists signed_at timestamptz, add column if not exists expiry_alert_days integer default 30, add column if not exists document_status text default 'draft';
alter table public.invoices add column if not exists project_id uuid references public.projects(id), add column if not exists invoice_type text default 'standard', add column if not exists payment_terms text, add column if not exists sent_at timestamptz, add column if not exists paid_at timestamptz, add column if not exists overdue_days integer default 0;
alter table public.expenses add column if not exists project_id uuid references public.projects(id), add column if not exists billable_to_client boolean default false, add column if not exists reimbursable boolean default false, add column if not exists approval_status text default 'pending', add column if not exists approved_by uuid references public.profiles(id), add column if not exists approved_at timestamptz;
alter table public.maintenance_contracts add column if not exists project_id uuid references public.projects(id);
alter table public.support_tickets add column if not exists project_id uuid references public.projects(id), add column if not exists due_date date, add column if not exists sla_hours numeric default 0, add column if not exists time_spent_hours numeric default 0, add column if not exists client_visible boolean default false;

create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_created_at on public.projects(created_at);
create index if not exists idx_quotations_client_id on public.quotations(client_id);
create index if not exists idx_quotations_project_id on public.quotations(project_id);
create index if not exists idx_quotations_status on public.quotations(status);
create index if not exists idx_quotations_created_at on public.quotations(created_at);
create index if not exists idx_quotations_number on public.quotations(quotation_number);
create index if not exists idx_contracts_client_id on public.contracts(client_id);
create index if not exists idx_contracts_project_id on public.contracts(project_id);
create index if not exists idx_contracts_status on public.contracts(status);
create index if not exists idx_contracts_created_at on public.contracts(created_at);
create index if not exists idx_contracts_number on public.contracts(contract_number);
create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoices_project_id on public.invoices(project_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_created_at on public.invoices(created_at);
create index if not exists idx_invoices_number on public.invoices(invoice_number);
create index if not exists idx_expenses_client_id on public.expenses(client_id);
create index if not exists idx_expenses_project_id on public.expenses(project_id);
create index if not exists idx_expenses_created_at on public.expenses(created_at);
create index if not exists idx_maintenance_project_id on public.maintenance_contracts(project_id);
create index if not exists idx_support_tickets_project_id on public.support_tickets(project_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
