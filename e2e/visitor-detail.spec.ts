import { expect, test } from "@playwright/test";

const SLUGS = ["example-route", "totally-fake-slug"];

for (const slug of SLUGS) {
  test(`route detail for "${slug}" shows Coming soon placeholder`, async ({ page }) => {
    const response = await page.goto(`/routes/${slug}`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: `路線 · ${slug}` })).toBeVisible();
    await expect(page.getByText("Coming soon")).toBeVisible();
    await expect(page.getByRole("link", { name: "回路線列表" })).toBeVisible();
  });
}
