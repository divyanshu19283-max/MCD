-- Persistent storage for complaint evidence photos.
--
-- Uploaded photos are no longer embedded as base64 in the complaints table;
-- they're uploaded to this bucket by the trusted server function (using the
-- service-role client, which bypasses storage RLS on write), and the
-- complaint's `photo_url` column stores the resulting public URL.
--
-- The bucket is public so photos can be displayed directly by URL without a
-- signing round trip; Supabase Storage serves public-bucket reads without
-- consulting storage.objects RLS policies, so no read policy is required.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-evidence',
  'complaint-evidence',
  true,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
