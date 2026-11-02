create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  client_id uuid references public.clients(id),
  quotation_id uuid references public.quotations(id),
  contract_id uuid references public.contracts(id),
  invoice_date date default current_date,
  due_date date,
  status text default 'draft' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  subtotal numeric default 0,
  discount_amount numeric default 0,
  tax_percentage numeric default 18,
  tax_amount numeric default 0,
  total_amount numeric default 0,
  amount_paid numeric default 0,
  balance_due numeric default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  payment_date date default current_date,
  amount numeric not null,
  payment_mode text,
  transaction_reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.invoices enable row level security;
alter table public.payments enable row level security;
drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();

create or replace function public.recalculate_invoice_payment_totals()
returns trigger language plpgsql as $$
declare target_invoice uuid;
begin
  target_invoice := coalesce(new.invoice_id, old.invoice_id);
  update public.invoices
  set amount_paid = coalesce((select sum(amount) from public.payments where invoice_id = target_invoice), 0),
      balance_due = greatest(total_amount - coalesce((select sum(amount) from public.payments where invoice_id = target_invoice), 0), 0),
      status = case
        when total_amount <= coalesce((select sum(amount) from public.payments where invoice_id = target_invoice), 0) then 'paid'
        when coalesce((select sum(amount) from public.payments where invoice_id = target_invoice), 0) > 0 then 'partially_paid'
        else status
      end,
      updated_at = now()
  where id = target_invoice;
  return coalesce(new, old);
end;
$$;

drop trigger if exists recalculate_invoice_after_payment on public.payments;
create trigger recalculate_invoice_after_payment after insert or update or delete on public.payments for each row execute function public.recalculate_invoice_payment_totals();

create policy "Authenticated users can read invoices" on public.invoices for select to authenticated using (true);
create policy "Authenticated users can insert invoices" on public.invoices for insert to authenticated with check (auth.uid() = created_by);
create policy "Authenticated users can update invoices" on public.invoices for update to authenticated using (true) with check (true);
create policy "Admins can delete invoices" on public.invoices for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Authenticated users can read payments" on public.payments for select to authenticated using (true);
create policy "Authenticated users can insert payments" on public.payments for insert to authenticated with check (auth.uid() = created_by);
create policy "Authenticated users can update payments" on public.payments for update to authenticated using (true) with check (true);
create policy "Admins can delete payments" on public.payments for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
