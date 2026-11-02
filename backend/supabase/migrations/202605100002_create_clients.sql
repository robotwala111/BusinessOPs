create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  client_short_name text,
  contact_person text,
  email text,
  phone text,
  gst_number text,
  pan_number text,
  address text,
  city text,
  state text,
  country text default 'India',
  industry text,
  lead_source text,
  status text not null default 'lead' check (
    status in ('lead', 'proposal_sent', 'active', 'inactive', 'closed')
  ),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_clients_updated_at on public.clients;

create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop policy if exists "Authenticated users can read clients" on public.clients;
create policy "Authenticated users can read clients"
on public.clients
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert clients" on public.clients;
create policy "Authenticated users can insert clients"
on public.clients
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update clients" on public.clients;
create policy "Authenticated users can update clients"
on public.clients
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can delete clients" on public.clients;
create policy "Admins can delete clients"
on public.clients
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
