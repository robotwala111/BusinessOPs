create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  full_name text not null,
  designation text,
  email text,
  phone text,
  whatsapp text,
  department text,
  is_primary boolean default false,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  activity_type text not null default 'follow_up' check (
    activity_type in (
      'call',
      'email',
      'meeting',
      'follow_up',
      'demo',
      'proposal_discussion',
      'payment_follow_up',
      'support_discussion',
      'general_note'
    )
  ),
  subject text not null,
  description text,
  activity_date timestamptz not null default now(),
  due_date timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references public.profiles(id),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_contacts_one_primary_per_client
on public.contacts(client_id)
where is_primary = true;

create index if not exists idx_contacts_client_id on public.contacts(client_id);
create index if not exists idx_contacts_full_name on public.contacts(full_name);
create index if not exists idx_activities_client_id on public.activities(client_id);
create index if not exists idx_activities_contact_id on public.activities(contact_id);
create index if not exists idx_activities_project_id on public.activities(project_id);
create index if not exists idx_activities_status on public.activities(status);
create index if not exists idx_activities_due_date on public.activities(due_date);
create index if not exists idx_activities_activity_date on public.activities(activity_date);

alter table public.contacts enable row level security;
alter table public.activities enable row level security;

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

drop trigger if exists set_activities_updated_at on public.activities;
create trigger set_activities_updated_at
before update on public.activities
for each row
execute function public.set_updated_at();

drop policy if exists "Authenticated users can read contacts" on public.contacts;
create policy "Authenticated users can read contacts"
on public.contacts for select to authenticated using (true);

drop policy if exists "Authenticated users can insert contacts" on public.contacts;
create policy "Authenticated users can insert contacts"
on public.contacts for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update contacts" on public.contacts;
create policy "Authenticated users can update contacts"
on public.contacts for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete contacts" on public.contacts;
create policy "Admins can delete contacts"
on public.contacts for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Authenticated users can read activities" on public.activities;
create policy "Authenticated users can read activities"
on public.activities for select to authenticated using (true);

drop policy if exists "Authenticated users can insert activities" on public.activities;
create policy "Authenticated users can insert activities"
on public.activities for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update activities" on public.activities;
create policy "Authenticated users can update activities"
on public.activities for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete activities" on public.activities;
create policy "Admins can delete activities"
on public.activities for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
