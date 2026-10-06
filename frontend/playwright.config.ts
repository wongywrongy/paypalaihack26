import { defineConfig, devices } from "@playwright/test";
const stackUrl = process.env.COALITION_E2E_URL;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  use: {
    baseURL: stackUrl || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: stackUrl
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
