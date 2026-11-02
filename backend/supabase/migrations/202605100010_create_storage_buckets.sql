insert into storage.buckets (id, name, public)
values ('signed-contracts', 'signed-contracts', false),
       ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

create policy "Authenticated users can read signed contracts"
on storage.objects for select to authenticated
using (bucket_id = 'signed-contracts');

create policy "Authenticated users can upload signed contracts"
on storage.objects for insert to authenticated
with check (bucket_id = 'signed-contracts');

create policy "Authenticated users can read expense receipts"
on storage.objects for select to authenticated
using (bucket_id = 'expense-receipts');

create policy "Authenticated users can upload expense receipts"
on storage.objects for insert to authenticated
with check (bucket_id = 'expense-receipts');
