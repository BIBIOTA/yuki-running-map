-- Drop manually-input metadata fields per
-- openspec/changes/feat-gpx-driven-route-metadata/design.md §3.1 row 0004.
--
-- Two columns and one enum type leave the routes table. `duration_s` was
-- nullable and `difficulty` was a NOT NULL enum that doubled as the routes-
-- table's only `difficulty` reference, so the type can be dropped right after
-- the column. PostgreSQL executes the whole file atomically; either every
-- DROP lands or none of them do.
ALTER TABLE "routes" DROP COLUMN "duration_s";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "difficulty";--> statement-breakpoint
DROP TYPE "public"."difficulty";
