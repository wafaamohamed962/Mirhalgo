-- MW_002 · storage buckets for company files (spec A5, decision 4).
--
-- Both buckets are PRIVATE: no public URLs. Files are named with random UUIDs
-- ({company_id}/{uuid}.{ext}) and written/read by the backend (service role) only.
-- Admins will get short-lived signed URLs (later plan). The logo stays private until the
-- company is approved (decision 4).
--
-- Size and type limits are enforced here too, as a second line behind the API checks
-- (magic bytes + size). Logos are re-encoded by the API, so they are always images.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('company-documents', 'company-documents', false, 5242880,
   array['application/pdf', 'image/jpeg', 'image/png']),
  ('company-logos', 'company-logos', false, 2097152,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No permissive policy grants anon/authenticated anything on these buckets (= no access).
-- This RESTRICTIVE policy keeps it that way even if a broad policy is added later for
-- another feature (e.g. "authenticated users can upload avatars"): it is ANDed with
-- every permissive policy.
create policy "company buckets: backend only"
on storage.objects
as restrictive
for all
to anon, authenticated
using (bucket_id not in ('company-documents', 'company-logos'))
with check (bucket_id not in ('company-documents', 'company-logos'));
