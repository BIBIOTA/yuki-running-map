-- 0003: Fix two related Storage RLS bugs surfaced by real-DB e2e:
--
-- 1. Missing admin SELECT policy on storage.objects (gpx bucket). The Wave C
--    migration shipped INSERT / UPDATE / DELETE policies for admin but no
--    SELECT policy. Supabase Storage's `.remove([paths])` internally does a
--    SELECT-then-DELETE — without SELECT permission the SELECT finds nothing
--    visible to admin, so DELETE never fires, but `.remove()` still returns
--    "successfully removed nothing" with no error. This caused
--    `deleteRoute` to silently fail to remove the GPX object even though the
--    DB row was deleted (orphan files accumulated in the bucket).
--
-- 2. `gpx_public_select_published` compares `routes.gpx_path` to
--    `storage.objects.name`. But the canonical column convention stores
--    `gpx_path` with the bucket prefix (e.g. `gpx/2026/{uuid}.gpx`) while
--    Storage's `objects.name` is the bucket-relative key (`2026/{uuid}.gpx`).
--    The two never match, so the public SELECT policy never grants access to
--    any object — meaning the public site couldn't render GPX downloads even
--    after a route is published. Fixed by comparing against
--    `'gpx/' || storage.objects.name`.

-- Add the missing admin SELECT policy.
CREATE POLICY gpx_admin_select ON storage.objects
FOR SELECT
USING (
  bucket_id = 'gpx'
  AND (auth.jwt() -> 'user_metadata' ->> 'user_name')
      = public.app_admin_github_username()
);
--> statement-breakpoint

-- Replace the public SELECT policy to align the path-prefix conventions.
DROP POLICY IF EXISTS gpx_public_select_published ON storage.objects;
--> statement-breakpoint

CREATE POLICY gpx_public_select_published ON storage.objects
FOR SELECT
USING (
  bucket_id = 'gpx'
  AND EXISTS (
    SELECT 1 FROM public.routes
    WHERE routes.gpx_path = ('gpx/' || storage.objects.name)
      AND routes.published = true
  )
);
