import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 8788);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: `wrangler pages dev --ip 127.0.0.1 --port ${port} --show-interactive-dev-session=false`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
