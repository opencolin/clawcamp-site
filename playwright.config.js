// Playwright config for ClawCamp's regression + quality-wall tests.
//
// v2.0.0: this harness is now PART OF CI. The .github/workflows/ci.yml
// `playwright` job runs the xss, a11y, and rls-coverage specs on every PR and
// every push to master, blocking promotion (the v1.x "NOT wired into CI /
// curl-only" deferral is over — enforcing these is the v2.0 exit criterion).
//
// Run it locally:  npm install && npx playwright install chromium && npm run test:e2e
//
// baseURL is env-configurable so the suite can run against prod (default), a
// Vercel preview URL, or a local static server. In CI the a11y/xss specs run
// against a local `npx serve` of the static repo (clean-URL routing that mirrors
// Vercel's cleanUrls), with BASE_URL=http://localhost:8080:
//   BASE_URL=http://localhost:8080 npm run test:e2e
// The rls-coverage spec is a pure file parse and needs no server at all.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry in CI to absorb transient network flakiness on the live-site specs
  // (the rls-coverage parse is deterministic and unaffected).
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
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
