create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null,
  quotation_date date not null default current_date,
  valid_until date,
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'accepted', 'rejected', 'expired')
  ),
  subtotal numeric(12, 2) not null default 0,
  discount_rate numeric(5, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 18,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  payment_terms text,
  notes text,
  terms_and_conditions text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotations enable row level security;

drop trigger if exists set_quotations_updated_at on public.quotations;

create trigger set_quotations_updated_at
before update on public.quotations
for each row
execute function public.set_updated_at();

drop policy if exists "Authenticated users can read quotations" on public.quotations;
create policy "Authenticated users can read quotations"
on public.quotations
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert quotations" on public.quotations;
create policy "Authenticated users can insert quotations"
on public.quotations
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update quotations" on public.quotations;
create policy "Authenticated users can update quotations"
on public.quotations
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can delete quotations" on public.quotations;
create policy "Admins can delete quotations"
on public.quotations
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
