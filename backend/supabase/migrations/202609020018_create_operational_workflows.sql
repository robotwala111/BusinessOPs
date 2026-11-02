-- Daily operational workflows following commercial lifecycle migration 017.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  entity_type text,
  entity_id uuid,
  category text not null check (category in ('requirement','proposal','quotation','contract','purchase_order','delivery_document','acceptance_document','invoice','receipt','payment_evidence','technical_document','general_attachment')),
  title text not null,
  description text,
  version_number integer not null default 1 check (version_number > 0),
  parent_document_id uuid references public.documents(id) on delete restrict,
  storage_bucket text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  document_date date,
  expiry_date date,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(parent_document_id, version_number)
);
create index if not exists idx_documents_project on public.documents(project_id, category, created_at desc);
create index if not exists idx_documents_entity on public.documents(entity_type, entity_id, created_at desc);
alter table public.documents enable row level security;
create policy "Authenticated users can read documents" on public.documents for select to authenticated using (true);
create policy "Authenticated users can insert documents" on public.documents for insert to authenticated with check (created_by = auth.uid());
create policy "Authenticated users can update documents" on public.documents for update to authenticated using (true) with check (true);

insert into storage.buckets(id, name, public) values ('business-documents','business-documents',false) on conflict(id) do nothing;
create policy "Authenticated users can read business documents" on storage.objects for select to authenticated using (bucket_id = 'business-documents');
create policy "Authenticated users can upload business documents" on storage.objects for insert to authenticated with check (bucket_id = 'business-documents');

create table if not exists public.financial_notes (
  id uuid primary key default gen_random_uuid(),
  note_number text not null unique,
  note_type text not null check (note_type in ('credit_note','debit_note')),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  note_date date not null default current_date,
  reason text not null,
  status text not null default 'draft' check (status in ('draft','approved','issued','cancelled')),
  base_amount numeric(14,2) not null check (base_amount > 0),
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null check (total_amount > 0),
  override_reason text,
  approved_at timestamptz,
  issued_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references auth.users(id),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.financial_notes enable row level security;
create trigger set_financial_notes_updated_at before update on public.financial_notes for each row execute function public.set_updated_at();
create index if not exists idx_financial_notes_invoice on public.financial_notes(invoice_id, status);
create policy "Authenticated users can read financial notes" on public.financial_notes for select to authenticated using (true);
create policy "Authenticated users can insert financial notes" on public.financial_notes for insert to authenticated with check (created_by = auth.uid());
create policy "Authenticated users can update financial notes" on public.financial_notes for update to authenticated using (true) with check (true);

insert into public.numbering_formats(document_type,prefix,include_year,separator,padding,next_number,is_active)
values ('credit_note','CRN',true,'-',4,1,true),('debit_note','DBN',true,'-',4,1,true)
on conflict(document_type) do nothing;

create table if not exists public.contract_relationships (
  id uuid primary key default gen_random_uuid(),
  source_contract_id uuid not null references public.contracts(id) on delete restrict,
  related_contract_id uuid not null references public.contracts(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('renewal','amendment')),
  reason text not null,
  effective_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(source_contract_id, related_contract_id)
);
alter table public.contract_relationships enable row level security;
-- A contract may have several amendments, but only one direct renewal. A later
-- renewal is linked from the renewed contract so the chain remains unambiguous.
create unique index if not exists idx_contract_relationship_one_renewal
  on public.contract_relationships(source_contract_id)
  where relationship_type = 'renewal';
create policy "Authenticated users can read contract relationships" on public.contract_relationships for select to authenticated using (true);
create policy "Authenticated users can insert contract relationships" on public.contract_relationships for insert to authenticated with check (created_by = auth.uid());

create table if not exists public.maintenance_renewals (
  id uuid primary key default gen_random_uuid(),
  source_maintenance_id uuid not null unique references public.maintenance_contracts(id) on delete restrict,
  renewed_maintenance_id uuid not null unique references public.maintenance_contracts(id) on delete restrict,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.maintenance_renewals enable row level security;
create policy "Authenticated users can read maintenance renewals" on public.maintenance_renewals for select to authenticated using (true);
create policy "Authenticated users can insert maintenance renewals" on public.maintenance_renewals for insert to authenticated with check (created_by = auth.uid());

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete restrict,
  comment text not null,
  client_visible boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.ticket_comments enable row level security;
create index if not exists idx_ticket_comments_ticket on public.ticket_comments(ticket_id, created_at);
create policy "Authenticated users can read ticket comments" on public.ticket_comments for select to authenticated using (true);
create policy "Authenticated users can insert ticket comments" on public.ticket_comments for insert to authenticated with check (created_by = auth.uid());

alter table public.notifications
  add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  add column if not exists category text,
  add column if not exists archived_at timestamptz;

create index if not exists idx_notifications_due on public.notifications(due_at) where read_at is null and dismissed_at is null;

create or replace function public.save_draft_invoice_lines(p_invoice_id uuid,p_lines jsonb,p_document_discount numeric default 0,p_rounding numeric default 0)
returns public.invoices language plpgsql security definer set search_path=public as $$
declare inv public.invoices%rowtype; line jsonb; gross numeric; line_discount numeric; taxable numeric; line_tax numeric; subtotal_sum numeric:=0; tax_sum numeric:=0; total_sum numeric; idx integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status<>'draft' then raise exception 'Only draft invoices may be edited'; end if;
  if jsonb_array_length(p_lines)=0 then raise exception 'At least one invoice line is required'; end if;
  delete from public.invoice_items where invoice_id=p_invoice_id;
  for line in select * from jsonb_array_elements(p_lines) loop
    if coalesce(line->>'description','')='' or (line->>'quantity')::numeric<=0 or (line->>'unit_price')::numeric<0 then raise exception 'Invalid invoice line'; end if;
    gross:=round((line->>'quantity')::numeric*(line->>'unit_price')::numeric,2);line_discount:=round(gross*coalesce((line->>'discount_rate')::numeric,0)/100,2);taxable:=greatest(gross-line_discount,0);line_tax:=round(taxable*coalesce((line->>'tax_rate')::numeric,0)/100,2);
    insert into public.invoice_items(invoice_id,description,hsn_sac,unit,quantity,unit_price,discount_rate,discount_amount,taxable_amount,tax_rate,tax_amount,line_total,sort_order)
    values(p_invoice_id,line->>'description',nullif(line->>'hsn_sac',''),nullif(line->>'unit',''),(line->>'quantity')::numeric,(line->>'unit_price')::numeric,coalesce((line->>'discount_rate')::numeric,0),line_discount,taxable,coalesce((line->>'tax_rate')::numeric,0),line_tax,taxable+line_tax,idx);
    subtotal_sum:=subtotal_sum+taxable;tax_sum:=tax_sum+line_tax;idx:=idx+1;
  end loop;
  total_sum:=greatest(subtotal_sum-greatest(p_document_discount,0),0)+tax_sum+p_rounding;
  if total_sum<0 then raise exception 'Invoice total cannot be negative'; end if;
  update public.invoices set subtotal=round(subtotal_sum,2),discount_amount=round(greatest(p_document_discount,0),2),tax_amount=round(tax_sum,2),rounding_amount=round(p_rounding,2),total_amount=round(total_sum,2),balance_due=greatest(round(total_sum,2)-amount_paid-tds_amount-credit_applied,0),updated_by=auth.uid(),updated_at=now() where id=p_invoice_id returning * into inv;
  return inv;
end;$$;
revoke all on function public.save_draft_invoice_lines(uuid,jsonb,numeric,numeric) from public;
grant execute on function public.save_draft_invoice_lines(uuid,jsonb,numeric,numeric) to authenticated;
