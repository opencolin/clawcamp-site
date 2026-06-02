// Playwright config for ClawCamp's locally-run regression tests.
//
// This harness is intentionally NOT part of CI: the v1.1.0 .github/workflows/
// ci.yml gate is deliberately curl-only (its comment says NOT to add Playwright
// there). Run it manually:  npm install && npx playwright install chromium && npm run test:e2e
//
// baseURL is env-configurable so the suite can run against prod (default) or a
// local static server, e.g.  BASE_URL=http://localhost:8080 npm run test:e2e
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://claw.camp',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
