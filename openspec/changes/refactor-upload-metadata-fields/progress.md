# Progress: refactor-upload-metadata-fields

## Session 1 — 2026-06-24 21:50
- Stage: TDD
- Task: 1.1 Write `lib/db/migrations/0009_drop_routes_tags.sql`
- Transition: not_started → in_progress
- Next action: Write a vitest meta-test asserting the migration file exists with the exact two DDL statements (DROP INDEX IF EXISTS routes_tags_gin; + ALTER TABLE routes DROP COLUMN tags;) and commit it as the red phase.
