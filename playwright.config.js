// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * The demo is a static site with no build step (index.html + plain <script> tags),
 * so we just need any static file server pointed at the repo root.
 * `npx serve` works well for this and needs no extra config.
 */
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    // The AI Chat replies rely on a real Azure OpenAI round-trip, so give
    // expect.poll()/toPass() a generous window instead of the 5s default.
    timeout: 20_000,
  },
  fullyParallel: false, // all tests share the same in-memory demo state model per page load, safe to parallelize per-file but keep workers modest
  retries: 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npx serve . -l 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
