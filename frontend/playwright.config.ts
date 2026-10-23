import { defineConfig, devices } from "@playwright/test";
const stackUrl = process.env.RALLY_E2E_URL;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  use: {
    baseURL: stackUrl || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    launchOptions: process.env.RALLY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.RALLY_CHROMIUM_EXECUTABLE } : undefined,
  },
  webServer: stackUrl
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        env: { VITE_RALLY_TEST_HARNESS: "1" },
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
