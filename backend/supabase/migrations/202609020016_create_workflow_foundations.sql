-- Production workflow foundations. This migration is intentionally additive and
-- follows the already-published 001-015 migrations.

create table if not exists public.entity_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  previous_value jsonb,
  new_value jsonb,
  description text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_entity_history_entity
  on public.entity_history(entity_type, entity_id, created_at desc);

alter table public.entity_history enable row level security;
drop policy if exists "Authenticated users can read entity history" on public.entity_history;
create policy "Authenticated users can read entity history"
  on public.entity_history for select to authenticated using (true);
drop policy if exists "Authenticated users can insert entity history" on public.entity_history;
create policy "Authenticated users can insert entity history"
  on public.entity_history for insert to authenticated
  with check (actor_id is null or actor_id = auth.uid());

-- History is append-only. No update or delete policy is intentionally provided.

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  name text not null,
  description text,
  deliverable text,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'planned' check (
    status in ('planned', 'in_progress', 'ready_for_review', 'accepted', 'invoiced', 'cancelled')
  ),
  planned_date date,
  actual_completion_date date,
  billing_percentage numeric(7, 4) check (billing_percentage between 0 and 100),
  billing_amount numeric(14, 2) check (billing_amount >= 0),
  acceptance_required boolean not null default true,
  completion_evidence text,
  internal_notes text,
  client_accepted_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete set null,
  override_reason text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_milestones enable row level security;
drop trigger if exists set_project_milestones_updated_at on public.project_milestones;
create trigger set_project_milestones_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();
create index if not exists idx_project_milestones_project on public.project_milestones(project_id, status);
drop policy if exists "Authenticated users can read project milestones" on public.project_milestones;
create policy "Authenticated users can read project milestones" on public.project_milestones
  for select to authenticated using (true);
drop policy if exists "Authenticated users can insert project milestones" on public.project_milestones;
create policy "Authenticated users can insert project milestones" on public.project_milestones
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Authenticated users can update project milestones" on public.project_milestones;
create policy "Authenticated users can update project milestones" on public.project_milestones
  for update to authenticated using (true) with check (true);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  due_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  deduplication_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
create index if not exists idx_notifications_recipient on public.notifications(recipient_id, read_at, due_at);
drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications" on public.notifications
  for select to authenticated using (recipient_id is null or recipient_id = auth.uid());
drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications" on public.notifications
  for update to authenticated using (recipient_id is null or recipient_id = auth.uid())
  with check (recipient_id is null or recipient_id = auth.uid());

create table if not exists public.ticket_time_entries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  entry_date date not null default current_date,
  hours numeric(8, 2) not null check (hours > 0),
  notes text,
  eligible_for_maintenance boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.ticket_time_entries enable row level security;
create index if not exists idx_ticket_time_entries_ticket on public.ticket_time_entries(ticket_id);
drop policy if exists "Authenticated users can read ticket time entries" on public.ticket_time_entries;
create policy "Authenticated users can read ticket time entries" on public.ticket_time_entries
  for select to authenticated using (true);
drop policy if exists "Authenticated users can insert ticket time entries" on public.ticket_time_entries;
create policy "Authenticated users can insert ticket time entries" on public.ticket_time_entries
  for insert to authenticated with check (created_by = auth.uid());

create table if not exists public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  content text,
  terms_and_conditions text,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  signed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(contract_id, version_number)
);

alter table public.contract_versions enable row level security;
drop policy if exists "Authenticated users can read contract versions" on public.contract_versions;
create policy "Authenticated users can read contract versions" on public.contract_versions
  for select to authenticated using (true);
drop policy if exists "Authenticated users can insert contract versions" on public.contract_versions;
create policy "Authenticated users can insert contract versions" on public.contract_versions
  for insert to authenticated with check (created_by = auth.uid());

-- Archival and actor metadata. Existing records remain active and valid.
alter table public.clients
  add column if not exists account_owner uuid references public.profiles(id) on delete set null,
  add column if not exists payment_terms text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.contacts
  add column if not exists is_billing_contact boolean not null default false,
  add column if not exists is_project_contact boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.leads
  add column if not exists campaign text,
  add column if not exists follow_up_date timestamptz,
  add column if not exists converted_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists converted_project_id uuid references public.projects(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.projects
  add column if not exists objectives text,
  add column if not exists scope text,
  add column if not exists assumptions text,
  add column if not exists dependencies text,
  add column if not exists exclusions text,
  add column if not exists budget numeric(14, 2) not null default 0,
  add column if not exists closure_notes text,
  add column if not exists client_accepted_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closure_override_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.quotations
  add column if not exists revision_number integer not null default 1,
  add column if not exists reviewed_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists superseded_at timestamptz,
  add column if not exists place_of_supply text,
  add column if not exists tax_type text check (tax_type is null or tax_type in ('cgst_sgst', 'igst', 'none')),
  add column if not exists rounding_amount numeric(12, 2) not null default 0,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.contracts
  add column if not exists approved_at timestamptz,
  add column if not exists sent_for_signature_at timestamptz,
  add column if not exists termination_reason text,
  add column if not exists notice_period_days integer,
  add column if not exists renewal_period_months integer,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.invoices
  add column if not exists milestone_id uuid references public.project_milestones(id) on delete set null,
  add column if not exists document_type text not null default 'tax_invoice',
  add column if not exists issue_date timestamptz,
  add column if not exists place_of_supply text,
  add column if not exists tax_type text check (tax_type is null or tax_type in ('cgst_sgst', 'igst', 'none')),
  add column if not exists tds_amount numeric(14, 2) not null default 0,
  add column if not exists credit_applied numeric(14, 2) not null default 0,
  add column if not exists rounding_amount numeric(12, 2) not null default 0,
  add column if not exists cancellation_reason text,
  add column if not exists write_off_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.payments
  add column if not exists bank_reference text,
  add column if not exists withholding_amount numeric(14, 2) not null default 0,
  add column if not exists adjustment_amount numeric(14, 2) not null default 0,
  add column if not exists evidence_path text,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text,
  add column if not exists reversed_by uuid references public.profiles(id) on delete set null;

alter table public.expenses
  add column if not exists description text,
  add column if not exists status text not null default 'draft',
  add column if not exists gst_number text,
  add column if not exists approval_comments text,
  add column if not exists rejected_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.maintenance_contracts
  add column if not exists response_sla_hours numeric(8, 2),
  add column if not exists resolution_sla_hours numeric(8, 2),
  add column if not exists billing_schedule text,
  add column if not exists renewed_from_id uuid references public.maintenance_contracts(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.support_tickets
  add column if not exists severity text,
  add column if not exists response_deadline timestamptz,
  add column if not exists resolution_deadline timestamptz,
  add column if not exists first_responded_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists reopening_reason text,
  add column if not exists internal_notes text,
  add column if not exists client_visible_notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- Atomic, row-locked document number allocation. The configured next_number is
-- the source of truth; callers no longer scan business tables for the latest value.
create or replace function public.next_document_number(p_document_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  format_record public.numbering_formats%rowtype;
  allocated_number integer;
  year_part text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into format_record
  from public.numbering_formats
  where document_type = p_document_type and is_active = true
  for update;

  if not found then
    raise exception 'No active numbering format for %', p_document_type;
  end if;

  allocated_number := format_record.next_number;
  update public.numbering_formats
  set next_number = next_number + 1, updated_at = now()
  where id = format_record.id;

  year_part := case when format_record.include_year then
    format_record.separator || extract(year from current_date)::integer::text
  else '' end;

  return format_record.prefix || year_part || format_record.separator ||
    lpad(allocated_number::text, format_record.padding, '0');
end;
$$;

revoke all on function public.next_document_number(text) from public;
grant execute on function public.next_document_number(text) to authenticated;

-- Atomic lead conversion creates the client, primary contact and optional project
-- in one transaction and guards against repeat conversion by locking the lead.
create or replace function public.convert_lead(
  p_lead_id uuid,
  p_create_project boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_lead public.leads%rowtype;
  new_client_id uuid;
  new_contact_id uuid;
  new_project_id uuid;
  project_number text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into source_lead from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if source_lead.converted_client_id is not null or source_lead.status = 'converted' then
    raise exception 'Lead has already been converted';
  end if;

  insert into public.clients (
    company_name, contact_person, email, phone, address, lead_source, status, notes, created_by
  ) values (
    source_lead.company_name, source_lead.contact_person, source_lead.email,
    source_lead.phone, source_lead.location, source_lead.lead_source,
    'active', source_lead.notes, auth.uid()
  ) returning id into new_client_id;

  if coalesce(source_lead.contact_person, '') <> '' then
    insert into public.contacts (
      client_id, full_name, email, phone, is_primary, is_billing_contact,
      is_project_contact, created_by
    ) values (
      new_client_id, source_lead.contact_person, source_lead.email, source_lead.phone,
      true, true, true, auth.uid()
    ) returning id into new_contact_id;
  end if;

  if p_create_project then
    project_number := public.next_document_number('project');
    insert into public.projects (
      client_id, project_code, project_name, project_type, description, status,
      project_value, assigned_manager, created_by
    ) values (
      new_client_id, project_number,
      source_lead.company_name || ' - ' || coalesce(source_lead.service_interested, 'Opportunity'),
      source_lead.service_interested, source_lead.notes, 'opportunity',
      source_lead.estimated_value, source_lead.assigned_to, auth.uid()
    ) returning id into new_project_id;
  end if;

  update public.leads set
    status = 'converted', converted_client_id = new_client_id,
    converted_contact_id = new_contact_id, converted_project_id = new_project_id,
    converted_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = p_lead_id;

  insert into public.entity_history (
    entity_type, entity_id, event_type, description, actor_id, metadata
  ) values (
    'lead', p_lead_id, 'lead_converted', 'Lead converted to connected business records',
    auth.uid(), jsonb_build_object('client_id', new_client_id, 'contact_id', new_contact_id, 'project_id', new_project_id)
  );

  return jsonb_build_object(
    'lead_id', p_lead_id, 'client_id', new_client_id,
    'contact_id', new_contact_id, 'project_id', new_project_id
  );
end;
$$;

revoke all on function public.convert_lead(uuid, boolean) from public;
grant execute on function public.convert_lead(uuid, boolean) to authenticated;

-- Normalize legacy values before replacing the original lifecycle constraints.
update public.leads set status = 'proposal_planned' where status in ('meeting_scheduled', 'proposal_required');
update public.projects set status = case status
  when 'lead' then 'opportunity'
  when 'discovery' then 'planned'
  when 'proposal' then 'opportunity'
  when 'approved' then 'planned'
  when 'in_progress' then 'active'
  when 'maintenance' then 'closed'
  else status end;
update public.quotations set status = 'sent' where status = 'sent';
update public.contracts set status = case status
  when 'sent' then 'sent_for_signature'
  when 'signed' then 'active'
  when 'cancelled' then 'terminated'
  else status end;
update public.invoices set status = 'issued' where status = 'sent';
update public.support_tickets set status = case status when 'open' then 'new' else status end;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (
  status in ('new', 'contacted', 'qualified', 'proposal_planned', 'converted', 'lost')
);
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check check (
  status in ('lead', 'proposal_sent', 'active', 'inactive', 'closed', 'archived')
);
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (
  status in ('opportunity', 'planned', 'active', 'on_hold', 'completed', 'closed', 'cancelled', 'archived')
);
alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations add constraint quotations_status_check check (
  status in ('draft', 'under_review', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'superseded')
);
alter table public.contracts drop constraint if exists contracts_status_check;
alter table public.contracts add constraint contracts_status_check check (
  status in ('draft', 'internal_review', 'approved', 'sent_for_signature', 'active', 'expired', 'terminated', 'renewed', 'archived')
);
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (
  status in ('draft', 'approved', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'written_off')
);
alter table public.expenses add constraint expenses_status_check check (
  status in ('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled')
);
alter table public.maintenance_contracts add constraint maintenance_contracts_status_check check (
  status in ('draft', 'active', 'expiring', 'renewed', 'expired', 'cancelled')
);
alter table public.support_tickets drop constraint if exists support_tickets_status_check;
alter table public.support_tickets add constraint support_tickets_status_check check (
  status in ('new', 'assigned', 'in_progress', 'waiting_for_client', 'resolved', 'closed', 'reopened', 'cancelled')
);

-- Recalculate invoice balances using only non-reversed payments and include
-- withholding and applied credits in the outstanding amount.
create or replace function public.recalculate_invoice_payment_totals()
returns trigger language plpgsql as $$
declare
  target_invoice uuid;
  allocated numeric;
  withheld numeric;
begin
  target_invoice := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount + adjustment_amount), 0), coalesce(sum(withholding_amount), 0)
    into allocated, withheld
  from public.payments
  where invoice_id = target_invoice and reversed_at is null;

  update public.invoices
  set amount_paid = allocated,
      tds_amount = withheld,
      balance_due = greatest(total_amount - allocated - withheld - credit_applied, 0),
      status = case
        when status in ('cancelled', 'written_off', 'draft') then status
        when total_amount - allocated - withheld - credit_applied <= 0 then 'paid'
        when allocated + withheld + credit_applied > 0 then 'partially_paid'
        when due_date < current_date then 'overdue'
        else status
      end,
      paid_at = case when total_amount - allocated - withheld - credit_applied <= 0 then now() else null end,
      updated_at = now()
  where id = target_invoice;
  return coalesce(new, old);
end;
$$;
