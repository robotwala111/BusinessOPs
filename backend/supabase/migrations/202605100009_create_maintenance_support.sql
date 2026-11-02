create table if not exists public.maintenance_contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  contract_id uuid references public.contracts(id),
  plan_name text not null,
  start_date date,
  end_date date,
  monthly_fee numeric default 0,
  yearly_fee numeric default 0,
  included_hours numeric default 0,
  status text default 'active',
  renewal_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  client_id uuid references public.clients(id),
  maintenance_contract_id uuid references public.maintenance_contracts(id),
  title text not null,
  description text,
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text default 'open' check (status in ('open', 'in_progress', 'waiting_for_client', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id),
  resolution_notes text,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.maintenance_contracts enable row level security;
alter table public.support_tickets enable row level security;
drop trigger if exists set_maintenance_contracts_updated_at on public.maintenance_contracts;
create trigger set_maintenance_contracts_updated_at before update on public.maintenance_contracts for each row execute function public.set_updated_at();
drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

create policy "Authenticated users can read maintenance contracts" on public.maintenance_contracts for select to authenticated using (true);
create policy "Authenticated users can insert maintenance contracts" on public.maintenance_contracts for insert to authenticated with check (auth.uid() = created_by);
create policy "Authenticated users can update maintenance contracts" on public.maintenance_contracts for update to authenticated using (true) with check (true);
create policy "Admins can delete maintenance contracts" on public.maintenance_contracts for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Authenticated users can read support tickets" on public.support_tickets for select to authenticated using (true);
create policy "Authenticated users can insert support tickets" on public.support_tickets for insert to authenticated with check (auth.uid() = created_by);
create policy "Authenticated users can update support tickets" on public.support_tickets for update to authenticated using (true) with check (true);
create policy "Admins can delete support tickets" on public.support_tickets for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
