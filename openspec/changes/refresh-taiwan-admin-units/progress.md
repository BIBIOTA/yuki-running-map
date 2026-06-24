# Progress: refresh-taiwan-admin-units

## Session 1 — 2026-06-24 23:30
- Stage: TDD
- Task: 1.1 + 1.2 — `normalizeAdminUnits` g0v COUNTYSN / TOWNSN fallback (paired Red/Green cycle)
- Transition: not_started → in_progress
- Next action: Add failing unit tests in `lib/regions/__tests__/normalizeAdminUnits.test.ts` covering the three spec scenarios (COUNTYSN fallback / TOWNSN+COUNTYSN fallback / existing COUNTYCODE/TOWNCODE still works) and commit as Red.
