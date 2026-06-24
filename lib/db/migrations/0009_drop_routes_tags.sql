-- Drop the now-unused routes.tags column and its supporting GIN index.
--
-- Order matters: PG dependency tracking issues a NOTICE when the column
-- backing an index is dropped, so DROP INDEX first, then DROP COLUMN.
--
-- Spec: openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
--       Requirement "0009 migration drops routes.tags and its GIN index"

DROP INDEX IF EXISTS "routes_tags_gin";--> statement-breakpoint

ALTER TABLE "routes" DROP COLUMN "tags";
