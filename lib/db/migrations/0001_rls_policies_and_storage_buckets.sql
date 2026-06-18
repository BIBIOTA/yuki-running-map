-- Wave C · RLS policies + Storage buckets + admin identity function
-- ─────────────────────────────────────────────────────────────
-- Encodes the auth/authz model from openspec design.md §3 (post Session 19 pivot):
--   • routes: anon reads only published rows; admin (matching identity function)
--     has full CRUD.
--   • storage.objects (gpx bucket): public read for objects referenced by a
--     published row; admin (matching identity function) has full CRUD.
--   • Admin identity is encoded by a SQL function `public.app_admin_github_username()`
--     returning the GitHub username; changing the admin = re-running CREATE OR
--     REPLACE FUNCTION in a follow-up migration. This replaces the original GUC
--     approach (ALTER DATABASE) because Supabase's managed `postgres` role lacks
--     permission to set cluster-level custom parameters.

-- 1. Storage buckets ----------------------------------------------------------
--    gpx   — public=true so published GPX downloads can use a public URL;
--            drafts are kept private by gpx_public_select_published policy.
--    tiles — public=true; PMTiles needs unrestricted Range requests.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gpx', 'gpx', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
--> statement-breakpoint

INSERT INTO storage.buckets (id, name, public)
VALUES ('tiles', 'tiles', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
--> statement-breakpoint

-- 2. Admin identity function --------------------------------------------------
--    Single source of truth for "who is the admin". CREATE OR REPLACE in a
--    follow-up migration to change admins. IMMUTABLE so the planner inlines it.
CREATE OR REPLACE FUNCTION public.app_admin_github_username()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 'bibiota'::text $$;
--> statement-breakpoint

-- 3. routes — enable RLS + policies ------------------------------------------
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY anon_read_published ON routes
FOR SELECT
USING (published = true);
--> statement-breakpoint

CREATE POLICY admin_full_access ON routes
FOR ALL
USING (
  (auth.jwt() -> 'user_metadata' ->> 'user_name')
    = public.app_admin_github_username()
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'user_name')
    = public.app_admin_github_username()
);
--> statement-breakpoint

-- 4. storage.objects — gpx bucket policies -----------------------------------
--    Public SELECT is conditional: only objects referenced by a published
--    route are readable by anon. Drafts (published=false) stay invisible.
CREATE POLICY gpx_public_select_published ON storage.objects
FOR SELECT
USING (
  bucket_id = 'gpx'
  AND EXISTS (
    SELECT 1 FROM routes
    WHERE gpx_path = storage.objects.name
      AND published = true
  )
);
--> statement-breakpoint

CREATE POLICY gpx_admin_write ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'gpx'
  AND (auth.jwt() -> 'user_metadata' ->> 'user_name')
      = public.app_admin_github_username()
);
--> statement-breakpoint

CREATE POLICY gpx_admin_modify ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'gpx'
  AND (auth.jwt() -> 'user_metadata' ->> 'user_name')
      = public.app_admin_github_username()
);
--> statement-breakpoint

CREATE POLICY gpx_admin_delete ON storage.objects
FOR DELETE
USING (
  bucket_id = 'gpx'
  AND (auth.jwt() -> 'user_metadata' ->> 'user_name')
      = public.app_admin_github_username()
);
