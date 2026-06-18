-- Wave C task 3.5 follow-up · sync admin identity to canonical GitHub case.
-- ───────────────────────────────────────────────────────────────────────────
-- Migration 0001 hardcoded 'bibiota' lowercase. Real GitHub OAuth returns
-- `user_metadata.user_name = 'BIBIOTA'` (preserved case from GitHub signup).
-- RLS policies compared `(auth.jwt()->'user_metadata'->>'user_name') = 'bibiota'`
-- and rejected the live session; middleware did the same with
-- ADMIN_GITHUB_USERNAME=bibiota and signed the user out.
--
-- Sync the function body to 'BIBIOTA'. The `.env.local` ADMIN_GITHUB_USERNAME
-- env var is updated in the same change to match.

CREATE OR REPLACE FUNCTION public.app_admin_github_username()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 'BIBIOTA'::text $$;
