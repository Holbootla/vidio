import { defineConfig, devices } from "@playwright/test";

const MOCK_API_PORT = process.env.MOCK_API_PORT ?? "18080";
const WEB_PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const mockApiUrl = `http://127.0.0.1:${MOCK_API_PORT}`;
const webUrl = `http://127.0.0.1:${WEB_PORT}`;

const appServerCommand = process.env.CI
  ? `pnpm start -p ${WEB_PORT}`
  : `NEXT_PUBLIC_API_BASE_URL=${mockApiUrl} VIDIO_API_BASE_URL=${mockApiUrl} pnpm build && pnpm start -p ${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    colorScheme: "dark",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node e2e/mock-api.mjs`,
      url: `${mockApiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { MOCK_API_PORT },
    },
    {
      command: appServerCommand,
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        PORT: WEB_PORT,
        HOSTNAME: "127.0.0.1",
        VIDIO_API_BASE_URL: mockApiUrl,
        NEXT_PUBLIC_API_BASE_URL: mockApiUrl,
        NODE_ENV: "production",
      },
    },
  ],
});
