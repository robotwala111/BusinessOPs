create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_number text unique not null,
  company_name text not null,
  contact_person text,
  email text,
  phone text,
  website text,
  location text,
  lead_source text,
  service_interested text,
  status text not null default 'new' check (
    status in (
      'new',
      'contacted',
      'meeting_scheduled',
      'qualified',
      'proposal_required',
      'converted',
      'lost'
    )
  ),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references public.profiles(id),
  estimated_value numeric default 0,
  expected_close_date date,
  notes text,
  lost_reason text,
  converted_client_id uuid references public.clients(id),
  converted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads enable row level security;

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_priority on public.leads(priority);
create index if not exists idx_leads_assigned_to on public.leads(assigned_to);
create index if not exists idx_leads_created_by on public.leads(created_by);
create index if not exists idx_leads_converted_client_id on public.leads(converted_client_id);
create index if not exists idx_leads_created_at on public.leads(created_at);
create index if not exists idx_leads_number on public.leads(lead_number);

drop policy if exists "Authenticated users can read leads" on public.leads;
create policy "Authenticated users can read leads"
on public.leads for select to authenticated using (true);

drop policy if exists "Authenticated users can insert leads" on public.leads;
create policy "Authenticated users can insert leads"
on public.leads for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update leads" on public.leads;
create policy "Authenticated users can update leads"
on public.leads for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete leads" on public.leads;
create policy "Admins can delete leads"
on public.leads for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
