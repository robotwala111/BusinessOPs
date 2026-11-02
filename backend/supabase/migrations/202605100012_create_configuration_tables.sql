create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  legal_name text,
  email text,
  phone text,
  website text,
  address text,
  gst_number text,
  pan_number text,
  logo_url text,
  primary_color text default '#f4b000',
  secondary_color text default '#111111',
  currency text default 'INR',
  default_tax_percentage numeric default 18,
  bank_details text,
  authorized_signatory_name text,
  default_footer_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  service_category text,
  description text,
  default_unit text,
  default_rate numeric default 0,
  default_duration_days integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  template_type text not null check (template_type in ('quotation', 'onboarding_contract', 'maintenance_contract', 'sow', 'nda', 'change_request', 'invoice', 'project_closure')),
  version integer default 1,
  content_json jsonb default '{}'::jsonb,
  terms_json jsonb default '{}'::jsonb,
  is_default boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.standard_terms (
  id uuid primary key default gen_random_uuid(),
  term_type text not null,
  title text not null,
  content text,
  is_default boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payment_milestone_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  milestone_name text not null,
  percentage numeric default 0,
  description text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  is_billable_default boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.project_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  default_template_id uuid references public.document_templates(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.company_settings enable row level security;
alter table public.service_catalog enable row level security;
alter table public.document_templates enable row level security;
alter table public.standard_terms enable row level security;
alter table public.payment_milestone_templates enable row level security;
alter table public.expense_categories enable row level security;
alter table public.project_types enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['company_settings','service_catalog','document_templates','standard_terms','payment_milestone_templates','expense_categories','project_types']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
    execute format('drop policy if exists "Authenticated users can read %s" on public.%I', table_name, table_name);
    execute format('create policy "Authenticated users can read %s" on public.%I for select to authenticated using (true)', table_name, table_name);
    execute format('drop policy if exists "Authenticated users can insert %s" on public.%I', table_name, table_name);
    execute format('create policy "Authenticated users can insert %s" on public.%I for insert to authenticated with check (true)', table_name, table_name);
    execute format('drop policy if exists "Authenticated users can update %s" on public.%I', table_name, table_name);
    execute format('create policy "Authenticated users can update %s" on public.%I for update to authenticated using (true) with check (true)', table_name, table_name);
    execute format('drop policy if exists "Admins can delete %s" on public.%I', table_name, table_name);
    execute format('create policy "Admins can delete %s" on public.%I for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = ''admin''))', table_name, table_name);
  end loop;
end $$;
