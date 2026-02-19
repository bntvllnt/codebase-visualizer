import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: "http://localhost:3344",
    headless: true,
  },
  webServer: {
    command: "NODE_ENV=production node e2e/server.mjs 3344",
    port: 3344,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
