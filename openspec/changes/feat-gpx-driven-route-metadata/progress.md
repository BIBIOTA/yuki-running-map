# Progress · feat-gpx-driven-route-metadata

依 `spec-driven-dev:test-driven-development` 規範，每次 status transition 記錄一個 Session entry。

---

## Session 1 — 2026-06-22 14:19
- Stage: TDD
- Task: 1.1 寫 migration `0004_drop_route_difficulty_and_duration.sql`
- Transition: not_started → in_progress
- Next action: Red phase — 在 `lib/db/__tests__/migration0004.test.ts` 寫 assertion，驗證 SQL 檔包含 `DROP COLUMN difficulty`、`DROP COLUMN duration_s`、`DROP TYPE` 三個語句；測試會 fail 因為 migration 檔尚未存在。

## Session 2 — 2026-06-22 14:30
- Stage: TDD
- Task: 1.1 寫 migration `0004_drop_route_difficulty_and_duration.sql`
- Transition: in_progress → passing
- Evidence:
  - Commits: d2319c2 test: red - migration 0004 drops routes.difficulty + routes.duration_s; cdba6d4 feat: green - drop routes.difficulty + routes.duration_s via migration 0004
  - Tests: `pnpm test --run lib/db/__tests__/migration0004.test.ts` → Test Files 1 passed (1) · Tests 5 passed (5)
  - Refactor: none (migration is pure SQL, test is minimal — nothing to extract)
  - Design verification: deferred — migration is DB-level, no visual; figma reference at `> See: ../../designs/figma.md` belongs to other Requirements in the same MODIFIED block. `verification-before-completion` will cover.
- Next action: Start task 1.2 — update `lib/db/schema.ts` 移除 `difficulty` / `durationS` columns 與 `difficultyEnum` export，並對應更新既有 `lib/db/__tests__/schema.test.ts` 的斷言。
