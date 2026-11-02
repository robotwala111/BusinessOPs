create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text unique not null,
  client_id uuid references public.clients(id),
  quotation_id uuid references public.quotations(id),
  contract_type text not null check (contract_type in ('onboarding', 'maintenance', 'sow', 'nda', 'change_request', 'project_closure')),
  title text not null,
  start_date date,
  end_date date,
  status text default 'draft' check (status in ('draft', 'sent', 'signed', 'active', 'expired', 'cancelled')),
  contract_value numeric default 0,
  renewal_required boolean default false,
  renewal_date date,
  content text,
  terms_and_conditions text,
  signed_file_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.contracts enable row level security;
drop trigger if exists set_contracts_updated_at on public.contracts;
create trigger set_contracts_updated_at before update on public.contracts for each row execute function public.set_updated_at();

drop policy if exists "Authenticated users can read contracts" on public.contracts;
create policy "Authenticated users can read contracts" on public.contracts for select to authenticated using (true);
drop policy if exists "Authenticated users can insert contracts" on public.contracts;
create policy "Authenticated users can insert contracts" on public.contracts for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "Authenticated users can update contracts" on public.contracts;
create policy "Authenticated users can update contracts" on public.contracts for update to authenticated using (true) with check (true);
drop policy if exists "Admins can delete contracts" on public.contracts;
create policy "Admins can delete contracts" on public.contracts for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
