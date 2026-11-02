-- Commercial lifecycle additions after workflow foundation 016.

alter table public.quotation_items
  add column if not exists unit text,
  add column if not exists hsn_sac text,
  add column if not exists discount_rate numeric(7, 4) not null default 0,
  add column if not exists discount_amount numeric(14, 2) not null default 0,
  add column if not exists taxable_amount numeric(14, 2) not null default 0;

alter table public.quotations
  add column if not exists return_to_draft_reason text,
  add column if not exists generated_contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists generated_project_id uuid references public.projects(id) on delete set null;

create unique index if not exists idx_quotations_one_contract
  on public.quotations(generated_contract_id) where generated_contract_id is not null;

alter table public.contracts
  add column if not exists billing_schedule text,
  add column if not exists scope text,
  add column if not exists deliverables text;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  description text not null,
  hsn_sac text,
  unit text,
  quantity numeric(12, 4) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  discount_rate numeric(7, 4) not null default 0 check (discount_rate between 0 and 100),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14, 2) not null default 0 check (taxable_amount >= 0),
  tax_rate numeric(7, 4) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14, 2) not null default 0 check (line_total >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoice_items enable row level security;
drop trigger if exists set_invoice_items_updated_at on public.invoice_items;
create trigger set_invoice_items_updated_at before update on public.invoice_items
  for each row execute function public.set_updated_at();
create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id, sort_order);
drop policy if exists "Authenticated users can read invoice items" on public.invoice_items;
create policy "Authenticated users can read invoice items" on public.invoice_items for select to authenticated using (true);
drop policy if exists "Authenticated users can insert invoice items" on public.invoice_items;
create policy "Authenticated users can insert invoice items" on public.invoice_items for insert to authenticated
  with check (exists (select 1 from public.invoices where invoices.id = invoice_items.invoice_id));
drop policy if exists "Authenticated users can update invoice items" on public.invoice_items;
create policy "Authenticated users can update invoice items" on public.invoice_items for update to authenticated using (true) with check (true);

create unique index if not exists idx_invoices_one_per_milestone
  on public.invoices(milestone_id) where milestone_id is not null and status <> 'cancelled';

alter table public.invoices
  add column if not exists reverse_charge boolean not null default false,
  add column if not exists amount_in_words text;

alter table public.projects
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text,
  add column if not exists final_invoice_waived boolean not null default false,
  add column if not exists deliverables_accepted boolean not null default false,
  add column if not exists reimbursable_expenses_processed boolean not null default false,
  add column if not exists required_documents_attached boolean not null default false;

-- Atomic accepted-quotation conversion. The quotation row is locked, and the
-- generated link prevents repeat conversion.
create or replace function public.convert_accepted_quotation_to_contract(p_quotation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_quotation public.quotations%rowtype;
  new_contract_id uuid;
  contract_number text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into source_quotation from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if source_quotation.status <> 'accepted' then raise exception 'Only accepted quotations can create contracts'; end if;
  if source_quotation.generated_contract_id is not null then return source_quotation.generated_contract_id; end if;

  contract_number := public.next_document_number('contract');
  insert into public.contracts (
    contract_number, client_id, project_id, quotation_id, contract_type, title,
    status, contract_value, content, terms_and_conditions, created_by
  ) values (
    contract_number, source_quotation.client_id, source_quotation.project_id,
    source_quotation.id, 'sow', source_quotation.title, 'draft',
    source_quotation.total_amount, source_quotation.scope_of_work,
    source_quotation.terms_and_conditions, auth.uid()
  ) returning id into new_contract_id;

  update public.quotations set generated_contract_id = new_contract_id,
    updated_by = auth.uid(), updated_at = now() where id = source_quotation.id;
  insert into public.entity_history(entity_type, entity_id, event_type, description, actor_id, metadata)
  values ('quotation', source_quotation.id, 'converted_to_contract',
    'Accepted quotation converted to contract', auth.uid(), jsonb_build_object('contract_id', new_contract_id));
  return new_contract_id;
end;
$$;

revoke all on function public.convert_accepted_quotation_to_contract(uuid) from public;
grant execute on function public.convert_accepted_quotation_to_contract(uuid) to authenticated;

