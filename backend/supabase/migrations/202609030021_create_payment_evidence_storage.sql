insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-evidence', 'payment-evidence', false, 10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read payment evidence" on storage.objects;
create policy "Authenticated users can read payment evidence"
on storage.objects for select to authenticated
using (bucket_id = 'payment-evidence');

drop policy if exists "Authenticated users can upload payment evidence" on storage.objects;
create policy "Authenticated users can upload payment evidence"
on storage.objects for insert to authenticated
with check (bucket_id = 'payment-evidence');
