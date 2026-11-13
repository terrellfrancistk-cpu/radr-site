import { defineConfig, devices } from "@playwright/test";

/**
 * radr.tkhub.app checks (added 2026-11-13). Serves the site folder locally and
 * never touches the live domain. Run: npx playwright test (from this folder).
 */
const port = 4180;
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs/,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "off",
    // Hermetic: no outside host resolves (fonts, stores and tkhub.app links are not fetched).
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] },
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory ../..`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
