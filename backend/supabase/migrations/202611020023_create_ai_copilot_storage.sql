create table if not exists public.copilot_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_copilot_conversations_user_updated
  on public.copilot_conversations(user_id, updated_at desc);

alter table public.copilot_conversations enable row level security;
create policy "Users can read their copilot conversations"
  on public.copilot_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can create their copilot conversations"
  on public.copilot_conversations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can update their copilot conversations"
  on public.copilot_conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.copilot_conversations to authenticated;

create table if not exists public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.copilot_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  records jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_copilot_messages_conversation_created
  on public.copilot_messages(conversation_id, created_at);

alter table public.copilot_messages enable row level security;
create policy "Users can read their copilot messages"
  on public.copilot_messages for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.copilot_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Users can create their copilot messages"
  on public.copilot_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'user'
    and exists (
      select 1 from public.copilot_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
grant select, insert on public.copilot_messages to authenticated;
grant select, insert on public.copilot_messages to service_role;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.copilot_conversations(id) on delete set null,
  operation text not null,
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  estimated_cost_usd numeric(12, 8) not null check (estimated_cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_created
  on public.ai_usage_events(user_id, created_at desc);

alter table public.ai_usage_events enable row level security;
create policy "Users can read their own AI usage"
  on public.ai_usage_events for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.ai_usage_events to authenticated;
grant select on public.ai_usage_events to service_role;

create table if not exists public.ai_usage_reservations (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reserved_cost_usd numeric(12, 8) not null check (reserved_cost_usd >= 0),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

alter table public.ai_usage_reservations enable row level security;

create or replace function public.reserve_copilot_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_hourly_limit integer,
  p_daily_budget_usd numeric,
  p_reserved_cost_usd numeric
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  hour_requests integer;
  daily_cost numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_user_id is null or p_request_id is null
    or p_hourly_limit < 1 or p_hourly_limit > 20
    or p_daily_budget_usd <= 0 or p_daily_budget_usd > 10
    or p_reserved_cost_usd <= 0 or p_reserved_cost_usd > 0.5 then
    raise exception 'Invalid Copilot budget reservation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('business-copilot-ai-budget', 0)
  );

  delete from public.ai_usage_reservations
  where released_at is not null and created_at < now() - interval '1 day';
  update public.ai_usage_reservations
  set reserved_cost_usd = 0, released_at = now()
  where released_at is null and created_at < now() - interval '15 minutes';

  select
    (select count(*) from public.ai_usage_events
     where user_id = p_user_id and created_at >= now() - interval '1 hour')
    +
    (select count(*) from public.ai_usage_reservations
     where user_id = p_user_id and created_at >= now() - interval '1 hour')
  into hour_requests;

  if hour_requests >= p_hourly_limit then
    return false;
  end if;

  select
    coalesce((select sum(estimated_cost_usd) from public.ai_usage_events
      where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'), 0)
    +
    coalesce((select sum(reserved_cost_usd) from public.ai_usage_reservations
      where released_at is null
        and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and created_at >= now() - interval '15 minutes'), 0)
  into daily_cost;

  if daily_cost + p_reserved_cost_usd > p_daily_budget_usd then
    return false;
  end if;

  insert into public.ai_usage_reservations(request_id, user_id, reserved_cost_usd)
  values (p_request_id, p_user_id, p_reserved_cost_usd);
  return true;
end;
$$;

create or replace function public.record_copilot_ai_usage(
  p_user_id uuid,
  p_request_id uuid,
  p_conversation_id uuid,
  p_operation text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation public.ai_usage_reservations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into reservation from public.ai_usage_reservations
  where request_id = p_request_id and user_id = p_user_id and released_at is null
  for update;
  if not found then
    raise exception 'Copilot request reservation not found';
  end if;
  if p_input_tokens < 0 or p_output_tokens < 0 or p_estimated_cost_usd < 0
    or p_estimated_cost_usd > reservation.reserved_cost_usd
    or char_length(p_operation) > 80 or char_length(p_model) > 200 then
    raise exception 'Invalid Copilot usage record';
  end if;
  if not exists (
    select 1 from public.copilot_conversations
    where id = p_conversation_id and user_id = p_user_id
  ) then
    raise exception 'Copilot conversation is not owned by this user';
  end if;

  insert into public.ai_usage_events(
    user_id, conversation_id, operation, model, input_tokens, output_tokens, estimated_cost_usd
  ) values (
    p_user_id, p_conversation_id, p_operation, p_model, p_input_tokens, p_output_tokens, p_estimated_cost_usd
  );
  delete from public.ai_usage_reservations where request_id = p_request_id;
end;
$$;

create or replace function public.release_copilot_ai_request(p_user_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  update public.ai_usage_reservations
  set reserved_cost_usd = 0, released_at = now()
  where request_id = p_request_id and user_id = p_user_id and released_at is null;
end;
$$;

revoke all on function public.reserve_copilot_ai_request(uuid, uuid, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.record_copilot_ai_usage(uuid, uuid, uuid, text, text, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.release_copilot_ai_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_copilot_ai_request(uuid, uuid, integer, numeric, numeric) to service_role;
grant execute on function public.record_copilot_ai_usage(uuid, uuid, uuid, text, text, integer, integer, numeric) to service_role;
grant execute on function public.release_copilot_ai_request(uuid, uuid) to service_role;

revoke all on public.ai_usage_reservations from public, anon, authenticated;

create or replace function public.copilot_security_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.application_security_migrations
    where migration_id = '202611020022_harden_profile_roles'
  );
$$;

revoke all on function public.copilot_security_ready() from public, anon, authenticated;
grant execute on function public.copilot_security_ready() to service_role;
