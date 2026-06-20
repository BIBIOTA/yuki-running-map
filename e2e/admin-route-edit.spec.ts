/**
 * Admin route edit happy-path e2e.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §5.2
 *
 * Coverage:
 *   seed a single `routes` row via the shared `seedRoute()` helper →
 *   admin OAuth-mock fixture → /admin/routes (table renders the seeded
 *   row) → click 「編輯」 link → expect URL /admin/routes/{id} →
 *   edit 「標題」 + add a tag via TagsInput → click 「儲存」 →
 *   assert sonner toast 「已儲存」 + still on /admin/routes/{id} +
 *   the new title is visible in the form. Then reload and confirm both
 *   the title and the newly-added tag persist (proving the DB was
 *   actually written, not just the React state).
 *
 * Each test truncates the `routes` table and clears the `gpx` Storage
 * bucket beforehand so the seeded row is the only one in the database
 * for the duration of the test.
 *
 * Execution gating: same four env knobs as `admin-upload.spec.ts`. When
 * any is missing the entire file is `test.skip`'d, keeping `pnpm test:e2e`
 * green on machines without a live Supabase. The spec is fully authored
 * + committed so a future environment with the secrets populated can
 * run it without changes — verification of actual pass status is
 * therefore VERIFICATION-PENDING (see
 * openspec/changes/feat-admin-gpx-upload/tasks.md §5.2).
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

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_USERNAME || !DATABASE_URL,
  "Skipping admin route edit e2e: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_GITHUB_USERNAME / DATABASE_URL not set",
);

test.describe("admin route edit flow", () => {
  test.beforeEach(async () => {
    await truncateRoutes();
    await clearGpxBucket();
  });

  test("admin edits seeded route, sees toast 已儲存, persists across reload", async ({
    page,
    context,
    baseURL,
  }) => {
    // 1. Seed a single route directly via Postgres. We capture the
    //    server-generated `id` so we can assert the edit URL exactly.
    const seeded = await seedRoute({
      slug: "edit-test",
      title: "Edit Test Route",
      tags: ["河濱", "LSD"],
    });

    // 2. Sign in as admin via the shared OAuth-mock fixture.
    await signInAsAdmin(page, context, baseURL);

    // 3. /admin/routes loads with the seeded row.
    const listResponse = await page.goto("/admin/routes", {
      waitUntil: "domcontentloaded",
    });
    expect(listResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/routes$/);

    // 4. Click the 「編輯」 link inside the seeded row. Scoping by row
    //    name keeps the locator unambiguous if future tests seed more
    //    than one row.
    await page
      .getByRole("row", { name: /Edit Test Route/ })
      .getByRole("link", { name: "編輯" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/routes/${seeded.id}$`));

    // 5. Edit 標題. `getByLabel('標題')` resolves to the
    //    `<Input id="title">` inside `<RouteMetadataForm>`.
    await page.getByLabel("標題").fill("Edited Route Title");

    // 6. Add a new tag via `<TagsInput>`. The component renders a
    //    native `<input aria-label="標籤">`; we commit via Enter
    //    (same code path as the production UX).
    const tagsInput = page.getByRole("textbox", { name: "標籤" });
    await tagsInput.fill("夜跑");
    await tagsInput.press("Enter");

    // 7. Save. `<RouteMetadataForm>`'s submit button stays on the page
    //    on success and surfaces a sonner toast 「已儲存」.
    await page.getByRole("button", { name: "儲存" }).click();

    // 8. Assert: toast visible + still on /admin/routes/{id} + new
    //    title value persisted in the form's controlled <input>.
    await expect(page.getByText("已儲存")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(`/admin/routes/${seeded.id}$`));
    await expect(page.getByLabel("標題")).toHaveValue("Edited Route Title");

    // 9. Reload and confirm DB persistence. The SSR Server Component
    //    refetches the row from Postgres, so seeing the new title +
    //    tag here proves the UPDATE actually committed.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("標題")).toHaveValue("Edited Route Title");
    // The new tag chip is rendered as a `<span>` by `<TagsInput>`.
    await expect(page.getByText("夜跑", { exact: true })).toBeVisible();
  });
});
