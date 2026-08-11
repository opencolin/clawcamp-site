// ===========================================================================
// tests/admin-submissions.spec.js — the /admin "Form Submissions" panel
// ===========================================================================
// WHAT THIS LOCKS IN:
//   The panel added alongside migration 0012 (contacts_select_admin) is the
//   first UI in the repo that reads `contacts` — the table every public form
//   writes into. Two invariants matter and both are asserted here:
//
//   1. TOKEN COLUMNS ARE NEVER REQUESTED. contacts carries verification_token
//      and magic_link_token. 0012's policy is ROW-level, so an admin JWT could
//      read those columns; the control that stops it is the explicit
//      SUB_COLUMNS allowlist in admin/index.html. A future edit that swaps it
//      for `select=*` would silently pull both tokens into the browser — the
//      exact leak 0001 was written to close (see its header: the tokens "must
//      NEVER cross the wire to an anon client"). This test fails on that edit.
//
//   2. SUBMISSIONS RENDER INERT. These rows are untrusted public input — anyone
//      can POST to /rest/v1/contacts (anon keeps the INSERT grant by design). A
//      hostile `name` must render as text, exactly like the events queue
//      invariant in xss.spec.js.
//
// WHY THE SESSION IS FAKED: /admin redirects anon to /get-involved before it
//   renders anything, and the magic-link flow cannot run headless. We seed the
//   supabase-js localStorage session directly (non-expired, so getSession()
//   resolves it without a network round-trip) and stub both REST reads. This
//   tests the RENDER path only — never the RLS gate, which is asserted from a
//   hostile anon client by scripts/rls-probe.sh.
//
// RUN LOCALLY (this spec needs the LOCAL build, not prod):
//   npx serve -l 8080 . &
//   BASE_URL=http://localhost:8080 npx playwright test tests/admin-submissions.spec.js
// ===========================================================================
const { test, expect } = require('@playwright/test');

// Must match ADMIN_EMAILS in admin/index.html — the client-side UX gate.
const ADMIN_EMAIL = 'collin@dabl.club';
// supabase-js v2 storage key: sb-<project-ref>-auth-token.
const PROJECT_REF = 'mrnccntqmkxjazznejfc';

const PAYLOAD = '<img src=x onerror=alert(1)>';

const CONTACT_ROWS = [
  {
    id: 9001,
    created_at: '2026-08-10T18:00:00Z',
    form_type: 'host',
    name: PAYLOAD,                      // hostile submitter name
    email: 'attacker@example.invalid',
    phone: '+1 555 0100',
    city: 'San Francisco',
    company: 'Evil Corp',
    about: 'Second payload: ' + PAYLOAD,
    event_details: 'Venue has 200 seats.'
  },
  {
    id: 9002,
    created_at: '2026-08-09T12:00:00Z',
    form_type: 'sponsor',
    name: 'Jane Roe',
    email: 'jane@example.invalid',
    company: 'Acme',
    tier: 'gold',
    message: 'We would like to sponsor the SF summit.'
  },
  {
    id: 9003,
    created_at: '2026-08-08T09:00:00Z',
    form_type: 'sponsor',
    name: 'Sam Poe',
    email: 'sam@example.invalid',
    tier: 'silver'
  }
];

// Arm the page: fake session + stubbed REST reads. Returns a state object that
// records whether an alert fired and every contacts URL the page requested.
async function armAdmin(page) {
  const state = { dialogFired: false, contactsUrls: [] };

  page.on('dialog', async (d) => {
    state.dialogFired = true;
    await d.dismiss().catch(() => {});
  });

  // Seed a non-expired session BEFORE any script runs, so clawAuth.getSession()
  // resolves from storage and gate() proceeds instead of redirecting.
  await page.addInitScript(
    ({ ref, email }) => {
      const session = {
        access_token: 'fake-access-token-for-render-test',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'fake-refresh-token',
        user: {
          id: '00000000-0000-4000-8000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          email: email,
          app_metadata: {},
          user_metadata: {}
        }
      };
      window.localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session));
    },
    { ref: PROJECT_REF, email: ADMIN_EMAIL }
  );

  // Events queue read — return empty so the queue renders its empty state and
  // the page reveals #adm-content.
  await page.route('**/rest/v1/events*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '[]'
    })
  );

  // Contacts read — record the URL (assertion 1) and return the fixture rows.
  await page.route('**/rest/v1/contacts*', (route) => {
    state.contactsUrls.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(CONTACT_ROWS)
    });
  });

  // Block the supabase-js auth endpoints so a background refresh cannot clear
  // the faked session mid-test.
  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{}'
    })
  );

  return state;
}

test.describe('/admin form-submissions panel', () => {
  test('renders submissions, filters by form_type, and never requests token columns', async ({ page }) => {
    const state = await armAdmin(page);

    await page.goto('/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // The panel populated (proves gate + fetch + render all ran).
    const cards = page.locator('#adm-subs .adm-sub-card');
    await expect(cards).toHaveCount(3);

    // --- ASSERTION 1: the token columns never crossed the wire --------------
    expect(state.contactsUrls.length).toBeGreaterThan(0);
    for (const url of state.contactsUrls) {
      expect(url, 'admin must not request verification_token').not.toContain('verification_token');
      expect(url, 'admin must not request magic_link_token').not.toContain('magic_link_token');
      // select=* would pull every column, tokens included.
      expect(url, 'admin must use an explicit column allowlist, not select=*').not.toMatch(/select=\*/);
      expect(url, 'admin must send an explicit select').toContain('select=');
    }

    // --- Filter chips: one per form_type, plus "all" ------------------------
    const chips = page.locator('#adm-filters .adm-chip');
    await expect(chips).toHaveCount(3); // all, sponsor (2), host (1)
    await expect(chips.first()).toHaveText('all (3)');

    // Clicking the sponsor chip narrows the list to the two sponsor rows.
    await page.locator('#adm-filters .adm-chip', { hasText: 'sponsor' }).click();
    await expect(cards).toHaveCount(2);
    await expect(page.locator('#adm-subs')).toContainText('Jane Roe');
    await expect(page.locator('#adm-subs')).not.toContainText('Evil Corp');

    // Back to all.
    await page.locator('#adm-filters .adm-chip', { hasText: 'all' }).click();
    await expect(cards).toHaveCount(3);
  });

  test('a hostile submission renders as inert text (stored-XSS wall)', async ({ page }) => {
    const state = await armAdmin(page);

    await page.goto('/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // The payload survives as visible TEXT...
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain(PAYLOAD);

    // ...but no <img> was ever parsed out of it (textContent, not innerHTML).
    const liveImgCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).filter((img) => {
        const onerr = img.getAttribute('onerror') || '';
        return img.getAttribute('src') === 'x' || onerr.indexOf('alert(1)') !== -1;
      }).length;
    });
    expect(liveImgCount).toBe(0);

    // ...and the onerror handler never executed.
    expect(state.dialogFired).toBe(false);
  });
});
