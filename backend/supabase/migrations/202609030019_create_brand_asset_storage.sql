insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read brand assets" on storage.objects;
create policy "Public can read brand assets"
on storage.objects for select to public
using (bucket_id = 'brand-assets');

drop policy if exists "Authenticated users can upload brand assets" on storage.objects;
create policy "Authenticated users can upload brand assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = 'company');

-- Brand files use immutable versioned paths. Replacing the company logo updates
-- company_settings.logo_url and retains earlier assets for document history.
