create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotation_items enable row level security;

drop trigger if exists set_quotation_items_updated_at on public.quotation_items;

create trigger set_quotation_items_updated_at
before update on public.quotation_items
for each row
execute function public.set_updated_at();

drop policy if exists "Authenticated users can read quotation items" on public.quotation_items;
create policy "Authenticated users can read quotation items"
on public.quotation_items
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert quotation items" on public.quotation_items;
create policy "Authenticated users can insert quotation items"
on public.quotation_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quotations
    where quotations.id = quotation_items.quotation_id
  )
);

drop policy if exists "Authenticated users can update quotation items" on public.quotation_items;
create policy "Authenticated users can update quotation items"
on public.quotation_items
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete quotation items" on public.quotation_items;
create policy "Authenticated users can delete quotation items"
on public.quotation_items
for delete
to authenticated
using (true);
