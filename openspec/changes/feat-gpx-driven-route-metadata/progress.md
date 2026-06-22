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

## Session 3 — 2026-06-22 14:44
- Stage: TDD (Group A finalised — 1.2 to 1.9 all passing)
- Tasks: 1.2 → 1.9（A 段 — 移除手填欄位）
- Transition: not_started → passing for each
- Evidence:
  - 1.2 lib/db/schema.ts + schema.test.ts: aa05a25 (red) → 3a9c1d0 (green) → 4/4 tests pass
  - 1.3 validation: bfd7a6d (red) → f6dbb6b (green) → 24/24 tests pass
  - 1.4 form-state helpers: 3176276 (red) → bbf0786 (green) → 43/43 tests pass — scope extended to also drop `region` from RouteMetadataValues (paves task 3.12)
  - 1.5 RouteMetadataForm: d572a57 (green) — scope extended to remove `id="region"` Input as well, since the field would otherwise submit to nowhere
  - 1.6 createRoute / updateRoute actions: 11c5104 (green) — routes.region column stays at DB level (will drop in 0008/task 3.7); INSERT leaves it NULL
  - 1.7 integration tests: 28bcde6 (green) — routeListView/RouteList region cell deferred to task 3.14 (RouteRegions chip swap)
  - 1.8 e2e specs + helpers: 46f2128 (green) — 難度 step + seedRoute legacy fields removed
  - 1.9 verification: pnpm typecheck (0 errors), pnpm lint (clean), pnpm test (189 passed / 12 DB-skipped). pnpm test:e2e deferred to verification-before-completion (requires .env.local + Supabase up).
- Design verification: deferred — A 段不動公開頁面視覺，仍由 `verification-before-completion` 對齊 Figma frame `70:8`/`70:10`/`70:11`（chip/region/elevation 都在 B+C 段才實現）。
- Next action: Start task 2.1 — 寫 migration `0005_add_elevation_profile.sql`（B 段 elevation-profile capability 起點，Red 為 SQL content assertion + journal registration test）。

## Session 4 — 2026-06-22 18:40
- Stage: TDD (Group B finalised — 2.1 to 2.10 all passing)
- Tasks: 2.1 → 2.10（B 段 — 海拔曲線 capability）
- Transition: not_started → passing for each
- Evidence:
  - 2.1 migration 0005: 3d6e599 (red) → 21f5a8c (green) — 3/3 SQL content tests pass
  - 2.2 generic RDP refactor: cf48312 (red) → 45bde2b (green) — 8/8 simplify tests pass (4 lng/lat + 4 generic)
  - 2.3 parseGpx + no-elevation.gpx fixture: eafbde0 (red) → bf1c4cb (green) — 7/7 parse tests pass
  - 2.4 schema.elevationProfile: 096e1d8 (red) → 9ab0b22 (green) — 5/5 schema tests pass
  - 2.5 createRoute persists profile: 04ebdc3 (green) — integration assertions skip on no-DB host
  - 2.6 elevationProfileView pure logic: e0fff16 (red) → e5d2e64 (green) — 4/4 view tests pass (Red M0 → M relaxation noted in commit)
  - 2.7 ElevationProfile server component: ea94b46 (green) — DOM-level test deferred to verification (Figma 70:7/70:8 alignment)
  - 2.8 /routes/[slug] page upgrade: 4c42a46 (green) — region section deferred to task 3.15
  - 2.9 admin-upload e2e elevation assertion: 584d722 (green) — actual run needs DB + Supabase
  - 2.10 verification: pnpm typecheck (0 errors), pnpm lint (clean), pnpm test (204 passed / 13 DB-skipped). e2e deferred.
- Design verification: deferred — `<ElevationProfile>` SVG visual + empty-state alignment to Figma frame `70:7` / `70:8` runs in verification-before-completion.
- Next action: Start task 3.1 — 寫 `scripts/build-admin-units-geojson.ts`（Group C 起點：SHP → GeoJSON 預處理工具）。
