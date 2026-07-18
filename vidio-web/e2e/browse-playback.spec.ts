import { test, expect } from "@playwright/test";
import { assertNoSeriousAxeViolations, login } from "./helpers";

const MOCK_API = `http://127.0.0.1:${process.env.MOCK_API_PORT ?? "18080"}`;
const PROFILE_ID = "22222222-2222-7222-8222-222222222222";

test.describe("browse and playback", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("board → detail → sources → watch with progress on continue watching", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Big Buck Bunny/i })).toBeVisible();
    await assertNoSeriousAxeViolations(page, "board");

    await page
      .getByRole("link", { name: /Big Buck Bunny/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Big Buck Bunny" })).toBeVisible();
    await assertNoSeriousAxeViolations(page, "detail");

    await page.getByRole("button", { name: "Add to library" }).click();
    await expect(page.getByText(/Added to your library/i)).toBeVisible();

    await page.getByRole("radio", { name: /1080p/i }).click();
    await page.getByRole("button", { name: "Play selected source" }).click();
    await expect(page).toHaveURL(/\/watch\//);
    await assertNoSeriousAxeViolations(page, "watch");

    await page.getByRole("button", { name: "Show keyboard shortcuts" }).click();
    await expect(page.getByRole("dialog", { name: /Keyboard shortcuts/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const progressResponse = await page.request.put(
      `${MOCK_API}/v1/profiles/${PROFILE_ID}/progress`,
      {
        data: {
          content_type: "movie",
          video_id: "tt1254207",
          media_id: "tt1254207",
          manifest_id: "org.stremio.cinemeta",
          position_secs: 600,
          duration_secs: 3600,
          watched: false,
        },
      },
    );
    expect(progressResponse.ok()).toBe(true);

    await page.goto("/board");
    await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Big Buck Bunny/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Resume" })).toBeVisible();
  });
});
