import { test, expect } from "@playwright/test";
import { assertNoSeriousAxeViolations, login } from "./helpers";

test.describe("library", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(
      "/detail/movie/tt1254207?manifest_id=org.stremio.cinemeta&installation_id=33333333-3333-7333-8333-333333333333",
    );
    await expect(page.getByRole("heading", { name: "Big Buck Bunny" })).toBeVisible();
    const libraryButton = page.getByRole("button", { name: /library/i });
    const label = (await libraryButton.textContent()) ?? "";
    if (label.includes("Add to library")) {
      await libraryButton.click();
      await expect(page.getByText(/Added to your library/i)).toBeVisible();
    }
  });

  test("adds and removes library entries", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("link", { name: /Big Buck Bunny/i }).first()).toBeVisible();
    await assertNoSeriousAxeViolations(page, "library");

    await page.getByRole("button", { name: /Remove Big Buck Bunny/i }).click();
    await expect(page.getByText(/Removed from your library/i)).toBeVisible();
    await expect(page.getByText("Big Buck Bunny")).toHaveCount(0);
  });
});
