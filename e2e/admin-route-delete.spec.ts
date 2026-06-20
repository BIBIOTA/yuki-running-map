/**
 * Admin route delete happy-path e2e.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §5.3
 *
 * Coverage:
 *   seed a single `routes` row via `seedRoute()` AND upload a matching
 *   placeholder GPX object via `uploadSeedGpxObject()` so both
 *   side-effects of `deleteRoute()` (DB row removal + Storage object
 *   removal) have observable starting state → admin OAuth-mock fixture
 *   → /admin/routes → click 「刪除」 in the seeded row → expect the
 *   Radix AlertDialog (`role="alertdialog"`) to appear with the
 *   confirmation copy 「確認刪除路線？」 → click 「確認刪除」 →
 *   assert (i) dialog closed, (ii) sonner toast 「已刪除「{title}」」
 *   visible, (iii) row gone from the table, (iv) DB row gone via
 *   `routeExistsById()`, (v) Storage object gone via `gpxObjectExists()`.
 *
 * Each test truncates the `routes` table and clears the `gpx` Storage
 * bucket beforehand so the seeded row + object are the only artefacts
 * in scope for the duration of the test.
 *
 * Execution gating: same four env knobs as `admin-upload.spec.ts` /
 * `admin-route-edit.spec.ts`. When any is missing the entire file is
 * `test.skip`'d, keeping `pnpm test:e2e` green on machines without a
 * live Supabase. The spec is fully authored + committed so a future
 * environment with the secrets populated can run it without changes —
 * verification of actual pass status is therefore VERIFICATION-PENDING
 * (see openspec/changes/feat-admin-gpx-upload/tasks.md §5.3).
 */

import { expect, test } from "@playwright/test";

import {
  ADMIN_USERNAME,
  DATABASE_URL,
  SERVICE_ROLE_KEY,
  signInAsAdmin,
  SUPABASE_URL,
} from "./helpers/adminAuth";
import { clearGpxBucket, truncateRoutes } from "./helpers/dbCleanup";
import { seedRoute } from "./helpers/seed";
import { gpxObjectExists, routeExistsById, uploadSeedGpxObject } from "./helpers/verify";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_USERNAME || !DATABASE_URL,
  "Skipping admin route delete e2e: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_GITHUB_USERNAME / DATABASE_URL not set",
);

test.describe("admin route delete flow", () => {
  test.beforeEach(async () => {
    await truncateRoutes();
    await clearGpxBucket();
  });

  test("admin opens delete dialog, confirms, sees toast and row gone", async ({
    page,
    context,
    baseURL,
  }) => {
    // 1. Seed a single route directly via Postgres AND upload a
    //    matching placeholder GPX object. Doing both lets us prove
    //    `deleteRoute()` removed both side-effects, not just the DB row.
    const seeded = await seedRoute({
      slug: "delete-test",
      title: "Delete Test Route",
      gpxPath: "gpx/2026/delete-test.gpx",
    });
    await uploadSeedGpxObject(seeded.gpxPath);

    // 2. Sanity-check the starting state — both the row and the object
    //    must exist before we click 刪除, otherwise the after-state
    //    assertions would be vacuously true.
    expect(await routeExistsById(seeded.id)).toBe(true);
    expect(await gpxObjectExists(seeded.gpxPath)).toBe(true);

    // 3. Sign in as admin via the shared OAuth-mock fixture.
    await signInAsAdmin(page, context, baseURL);

    // 4. /admin/routes loads with the seeded row.
    const listResponse = await page.goto("/admin/routes", {
      waitUntil: "domcontentloaded",
    });
    expect(listResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/routes$/);

    // 5. Click the 「刪除」 button inside the seeded row. Scoping by row
    //    name keeps the locator unambiguous even if future tests seed
    //    more than one row.
    const seededRow = page.getByRole("row", { name: /Delete Test Route/ });
    await seededRow.getByRole("button", { name: "刪除" }).click();

    // 6. Radix AlertDialog appears — `<DeleteRouteButton>` overrides
    //    the shadcn `<Dialog>` primitive's default `role="dialog"` with
    //    `role="alertdialog"` to re-establish AlertDialog semantics
    //    (per the component's primitive-choice note); the title
    //    string is load-bearing from Figma frame 07.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("確認刪除路線？")).toBeVisible();

    // 7. Confirm. `<DeleteRouteButton>` invokes the `deleteRoute({ id })`
    //    Server Action; on `{ ok: true }` it closes the dialog,
    //    fires a sonner toast, and `router.refresh()`s the SSR list.
    await page.getByRole("button", { name: "確認刪除" }).click();

    // 8. Dialog closes + sonner toast 「已刪除「Delete Test Route」」
    //    visible. The success-toast format is owned by
    //    `buildSuccessToast()` in `features/admin-routes/deleteButtonState.ts`
    //    and must stay in sync with this assertion.
    await expect(dialog).toBeHidden();
    await expect(page.getByText("已刪除「Delete Test Route」")).toBeVisible({
      timeout: 5000,
    });

    // 9. Row gone from the (refreshed) list — `router.refresh()` re-runs
    //    the parent Server Component which re-projects the truncated
    //    `routes` table.
    await expect(
      page.getByRole("row", { name: /Delete Test Route/ }),
    ).toHaveCount(0);

    // 10. DB persistence — the row really is gone from Postgres, not
    //     just from the in-memory React tree.
    expect(await routeExistsById(seeded.id)).toBe(false);

    // 11. Storage persistence — the GPX object really is gone from
    //     the `gpx` bucket, proving the Server Action's Storage delete
    //     side-effect fired.
    expect(await gpxObjectExists(seeded.gpxPath)).toBe(false);
  });
});
