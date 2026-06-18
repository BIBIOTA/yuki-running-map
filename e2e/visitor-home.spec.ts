import { expect, test } from "@playwright/test";

test("home page renders hero and CTA → /routes", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Yuki's Running Map" })).toBeVisible();

  const cta = page.getByRole("link", { name: "瀏覽路線" });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/routes");
});
