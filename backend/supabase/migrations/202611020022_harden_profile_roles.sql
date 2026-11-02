alter table public.profiles
  alter column role set default 'staff';

-- Earlier signups inherited the admin default, so existing roles are untrusted.
update public.profiles
set role = 'staff'
where role <> 'staff';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'staff'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

create or replace function public.prevent_self_role_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) = old.id and new.role is distinct from old.role then
    raise exception 'Users cannot change their own role.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_self_role_changes on public.profiles;
create trigger prevent_self_role_changes
before update of role on public.profiles
for each row
execute function public.prevent_self_role_changes();

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and role = 'staff');

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
on public.profiles
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create table if not exists public.application_security_migrations (
  migration_id text primary key,
  applied_at timestamptz not null default now()
);

alter table public.application_security_migrations enable row level security;
revoke all on public.application_security_migrations from public, anon, authenticated;
grant select on public.application_security_migrations to service_role;

insert into public.application_security_migrations(migration_id)
values ('202611020022_harden_profile_roles')
on conflict (migration_id) do nothing;
