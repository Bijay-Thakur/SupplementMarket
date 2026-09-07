import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev:backend",
      cwd: path.resolve(__dirname, ".."),
      url: "http://localhost:8000/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
