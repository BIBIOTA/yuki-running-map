import { expect, test } from "@playwright/test";

import { ADMIN_USERNAME, SERVICE_ROLE_KEY, signInAsAdmin, SUPABASE_URL } from "./helpers/adminAuth";

test("authenticated admin reaches /admin/upload and sees upload UI + sign out", async ({
  page,
  context,
  baseURL,
}) => {
  expect(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL must be set").not.toBe("");
  expect(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY must be set").not.toBe("");
  expect(ADMIN_USERNAME, "ADMIN_GITHUB_USERNAME must be set").not.toBe("");
  expect(baseURL, "Playwright baseURL must be set").toBeTruthy();

  // Compose the full admin OAuth-mock sign-in (Admin API → magic link
  // → harvest tokens → write @supabase/ssr cookie).
  await signInAsAdmin(page, context, baseURL);

  // Navigate to /admin/upload — middleware reads cookie → auth.getUser()
  // → admin match → render the real upload UI (NOT the old Coming-soon
  // placeholder; the SSR page now mounts <UploadPageClient>).
  const response = await page.goto("/admin/upload", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/upload$/);
  await expect(page.getByText("拖放 GPX 或點擊選擇")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
