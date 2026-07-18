import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const testUser = {
  email: "e2e@example.com",
  password: "password123",
  profileName: "E2E",
};

export async function login(page: Page) {
  const mockApi = `http://127.0.0.1:${process.env.MOCK_API_PORT ?? "18080"}`;
  await page.request.post(`${mockApi}/__test__/reset`);

  await page.goto("/login");
  await page.getByLabel("Email").fill(testUser.email);
  await page.getByLabel("Password").fill(testUser.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("heading", { name: "Popular Movies" })).toBeVisible({
    timeout: 15_000,
  });
}

export async function register(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(testUser.email);
  await page.getByLabel("Profile name").fill(testUser.profileName);
  await page.getByLabel("Password", { exact: true }).fill(testUser.password);
  await page.getByLabel("Confirm password").fill(testUser.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/board$/);
}

export async function assertNoSeriousAxeViolations(page: Page, context?: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    serious,
    context ? `axe serious/critical on ${context}: ${JSON.stringify(serious, null, 2)}` : undefined,
  ).toEqual([]);
}
