create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text unique not null,
  expense_date date default current_date,
  category text not null check (category in ('cloud', 'hosting', 'domain', 'software_subscription', 'freelancer', 'salary', 'marketing', 'travel', 'hardware', 'office', 'miscellaneous')),
  vendor_name text,
  client_id uuid references public.clients(id),
  project_or_reference text,
  amount numeric not null,
  tax_amount numeric default 0,
  total_amount numeric not null,
  payment_mode text,
  receipt_file_url text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.expenses enable row level security;
drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();
create policy "Authenticated users can read expenses" on public.expenses for select to authenticated using (true);
create policy "Authenticated users can insert expenses" on public.expenses for insert to authenticated with check (auth.uid() = created_by);
create policy "Authenticated users can update expenses" on public.expenses for update to authenticated using (true) with check (true);
create policy "Admins can delete expenses" on public.expenses for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
