create table if not exists public.numbering_formats (
  id uuid primary key default gen_random_uuid(),
  document_type text unique not null,
  prefix text not null,
  include_year boolean default true,
  separator text default '-',
  padding integer default 4,
  next_number integer default 1,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.configurable_options (
  id uuid primary key default gen_random_uuid(),
  option_group text not null,
  option_key text not null,
  label text not null,
  color text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (option_group, option_key)
);

insert into public.numbering_formats (document_type, prefix, include_year, separator, padding, next_number, is_active)
values
  ('lead', 'LEAD', true, '-', 4, 1, true),
  ('project', 'PRJ', true, '-', 4, 1, true),
  ('quotation', 'QTN', true, '-', 4, 1, true),
  ('contract', 'CON', true, '-', 4, 1, true),
  ('invoice', 'INV', true, '-', 4, 1, true),
  ('expense', 'EXP', true, '-', 4, 1, true),
  ('support_ticket', 'TKT', true, '-', 4, 1, true)
on conflict (document_type) do nothing;

alter table public.numbering_formats enable row level security;
alter table public.configurable_options enable row level security;

drop trigger if exists set_numbering_formats_updated_at on public.numbering_formats;
create trigger set_numbering_formats_updated_at
before update on public.numbering_formats
for each row
execute function public.set_updated_at();

drop trigger if exists set_configurable_options_updated_at on public.configurable_options;
create trigger set_configurable_options_updated_at
before update on public.configurable_options
for each row
execute function public.set_updated_at();

create index if not exists idx_configurable_options_group
on public.configurable_options(option_group);

create index if not exists idx_configurable_options_active
on public.configurable_options(is_active);

drop policy if exists "Authenticated users can read numbering formats" on public.numbering_formats;
create policy "Authenticated users can read numbering formats"
on public.numbering_formats for select to authenticated using (true);

drop policy if exists "Authenticated users can insert numbering formats" on public.numbering_formats;
create policy "Authenticated users can insert numbering formats"
on public.numbering_formats for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update numbering formats" on public.numbering_formats;
create policy "Authenticated users can update numbering formats"
on public.numbering_formats for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete numbering formats" on public.numbering_formats;
create policy "Admins can delete numbering formats"
on public.numbering_formats for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Authenticated users can read configurable options" on public.configurable_options;
create policy "Authenticated users can read configurable options"
on public.configurable_options for select to authenticated using (true);

drop policy if exists "Authenticated users can insert configurable options" on public.configurable_options;
create policy "Authenticated users can insert configurable options"
on public.configurable_options for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update configurable options" on public.configurable_options;
create policy "Authenticated users can update configurable options"
on public.configurable_options for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete configurable options" on public.configurable_options;
create policy "Admins can delete configurable options"
on public.configurable_options for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
