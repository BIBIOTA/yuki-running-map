# Progress: refresh-taiwan-admin-units

## Session 1 — 2026-06-24 23:30
- Stage: TDD
- Task: 1.1 + 1.2 — `normalizeAdminUnits` g0v COUNTYSN / TOWNSN fallback (paired Red/Green cycle)
- Transition: not_started → in_progress
- Next action: Add failing unit tests in `lib/regions/__tests__/normalizeAdminUnits.test.ts` covering the three spec scenarios (COUNTYSN fallback / TOWNSN+COUNTYSN fallback / existing COUNTYCODE/TOWNCODE still works) and commit as Red.

## Session 2 — 2026-06-24 23:35
- Stage: TDD
- Task: 1.1 + 1.2 normalizeAdminUnits g0v fallback
- Transition: in_progress → passing
- Evidence:
  - Commits: 981e72f test: red - normalizeAdminUnits g0v COUNTYSN/TOWNSN fallback (3 spec scenarios); (green commit follows)
  - Tests: `pnpm vitest run lib/regions/__tests__/normalizeAdminUnits.test.ts` → 8 passed (8)
- Next action: Start Task 2.1 (refresh script) — write a failing test that mocks `fetch` returning stub g0v payloads, runs the script's main function, and asserts the normalised seed file is written.

## Session 3 — 2026-06-24 23:45
- Stage: TDD
- Task: 2.1 + 2.2 + 2.3 refresh script (helper + CLI wrapper + pnpm alias + error handling)
- Transition: not_started → in_progress → passing
- Evidence:
  - Commits: a89616e test: red - refreshAdminUnits pipeline (4 spec scenarios); (green commit follows)
  - Tests: `pnpm vitest run lib/admin-units-refresh/__tests__/refreshAdminUnits.test.ts` → 4 passed (4)
  - Typecheck: `pnpm typecheck` exit 0
- Next action: Run `pnpm refresh:admin-units` to generate the real seed file (Task 3.1).

## Session 4 — 2026-06-24 23:55
- Stage: TDD
- Task: 3.1 + amendment to refreshAdminUnits (g0v COUNTYSN synthesis)
- Transition: in_progress → passing
- Evidence:
  - Commits: cee5dd8 test: red - refreshAdminUnits synthesises COUNTYSN onto g0v townships; (green commit follows)
  - Tests: `pnpm vitest run lib/admin-units-refresh/__tests__/refreshAdminUnits.test.ts` → 5 passed (5)
  - Real run: `pnpm refresh:admin-units` → `Wrote 399 features ...` (22 counties + 377 townships); `瑞芳區` present with `parent_code = 10001001 (新北市)`.
- Next action: Write migration 0010 — inline the 68 MB seed as a jsonb literal, TRUNCATE admin_units CASCADE, INSERT with ST_MakeValid, then INSERT route_admin_units via ST_Intersects.
