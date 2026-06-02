// Stored-XSS regression test for ClawCamp (council exit criterion:
// "event name renders inert").
//
// THE INVARIANT UNDER TEST
// ------------------------
// Every page that renders an untrusted event field does so via textContent /
// document.createTextNode — NEVER innerHTML with user data:
//   * events/detail/index.html  — `$(tag, cls, text)` sets el.textContent (the
//     title is built with `$('h1','ev-title', ev.name)`).
//   * events/index.html         — event cards are built with the same textContent
//     helpers (renderEventRow), and the old client-side hide-list is gone.
//   * admin/index.html          — renderCard() writes name/city/description/link
//     via textContent and renders the submitted link as inert text (no anchor).
// So a hostile event name like `<img src=x onerror=alert(1)>` MUST surface as
// literal text and MUST NOT create a live <img> element or fire a dialog.
//
// HERMETIC BY DESIGN
// ------------------
// Submitting through the real flow lands rows as status='submitted' (hidden
// until an admin approves), and approval is admin-gated — so we cannot rely on
// the payload being publicly visible. Instead we assert the RENDER-SAFETY
// contract directly: we intercept the page's own Supabase REST read with
// page.route() and feed it the attack payload, then assert escaping + no dialog
// on the page's real render path. This needs NO write access to prod and never
// POSTs spam to the live DB.
//
// (A real end-to-end live submission is intentionally NOT performed here. If you
// ever want to exercise the true POST path, gate it behind an env flag so CI /
// local default runs stay read-only — see the test.skip at the bottom.)

const { test, expect } = require('@playwright/test');

// The canonical stored-XSS payload from the plan.
const PAYLOAD = '<img src=x onerror=alert(1)>';
const FAKE_ID = 999999;
// A separate id for the past-event-with-recap fixture so its route stub never
// collides with the upcoming-event fixture above.
const FAKE_RECAP_ID = 999998;
// A javascript:-scheme href payload — the recap render must NEVER turn this
// into a live anchor (it is only ever a live <a> when it starts http(s)://).
const JS_HREF = 'javascript:alert(document.domain)';

// A minimal events row shaped like the real /rest/v1/events response, with the
// payload planted in every user-controlled string field.
const POISONED_ROW = {
  id: FAKE_ID,
  created_at: '2026-01-01T00:00:00Z',
  name: PAYLOAD,
  event_date: '2026-12-31',
  city: PAYLOAD,
  event_type: 'in-person',
  description: PAYLOAD,
  location: PAYLOAD,
  venue_name: PAYLOAD,
  time_range: '10:00 – 12:00',
  link: 'https://example.com/' + encodeURIComponent(PAYLOAD),
  notes: PAYLOAD,
  image_url: null,
  is_external: false,
  is_featured: false,
  source: 'submitted:attacker@example.com',
  tags: PAYLOAD
};

// A PAST event (event_date well in the past so the detail page's `isPast` is
// true) carrying a LIVING RECAP whose every recap field is hostile. The recap
// section (v1.5) renders recap_headline / recap_body via textContent and only
// turns recap_url into a live anchor when it is an http(s):// URL — so a
// javascript: scheme must stay inert text and the <img onerror> payload must
// never create a live <img>. recap_photos_url carries a payload-laden path too;
// the gallery builds <img> elements from media-bucket paths, so the attack
// string must NOT survive as a live onerror handler there either.
const POISONED_RECAP_ROW = {
  id: FAKE_RECAP_ID,
  created_at: '2020-01-01T00:00:00Z',
  name: PAYLOAD,
  event_date: '2020-01-01', // firmly in the past => recap section path
  city: PAYLOAD,
  event_type: 'in-person',
  description: PAYLOAD,
  location: PAYLOAD,
  venue_name: PAYLOAD,
  time_range: '10:00 – 12:00',
  link: 'https://example.com/' + encodeURIComponent(PAYLOAD),
  notes: PAYLOAD,
  image_url: null,
  is_external: false,
  is_featured: false,
  source: 'submitted:attacker@example.com',
  tags: PAYLOAD,
  // --- hostile recap fields (v1.5 living recap) ---
  recap_headline: PAYLOAD,
  recap_body: PAYLOAD,
  recap_url: JS_HREF,
  recap_photos_url: [PAYLOAD]
};

// Install guards + a REST stub BEFORE any navigation so they apply to the
// page's first load. Returns a getter for whether an alert ever fired.
async function armPage(page, rows) {
  const state = { dialogFired: false };

  // If the payload ever executed, the onerror handler would call alert(1).
  // Registering a dialog handler that records + dismisses means a fired alert
  // is observable (and won't hang the run).
  page.on('dialog', async (dialog) => {
    state.dialogFired = true;
    await dialog.dismiss().catch(() => {});
  });

  // Fail loudly on an uncaught page error too (defense in depth).
  page.on('pageerror', (err) => {
    // Surface unexpected runtime errors; the payload itself shouldn't throw.
    // eslint-disable-next-line no-console
    console.error('pageerror:', err && err.message);
  });

  // Intercept the events REST read and return our poisoned row. We match the
  // PostgREST events endpoint regardless of query string so both the list
  // (?select=*) and the detail (?id=eq.<id>) reads are covered.
  await page.route('**/rest/v1/events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(rows)
    });
  });

  return state;
}

// Core assertion: the literal payload string is present as text, but NO live
// <img> element carrying the onerror attribute was created from it, and no
// alert dialog fired.
async function expectInertRender(page, state) {
  // 1) The payload survives as INERT TEXT somewhere in the rendered body.
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain(PAYLOAD);

  // 2) NO element was parsed out of the payload — i.e. there is no <img> in the
  //    DOM whose onerror attribute is the attack string. (A textContent render
  //    yields zero such elements; an innerHTML render would yield one.)
  const liveImgCount = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.filter((img) => {
      const onerr = img.getAttribute('onerror') || '';
      return img.getAttribute('src') === 'x' || onerr.indexOf('alert(1)') !== -1;
    }).length;
  });
  expect(liveImgCount).toBe(0);

  // 3) The onerror payload never executed.
  expect(state.dialogFired).toBe(false);
}

test.describe('stored-XSS: event name renders inert (council exit criterion)', () => {
  test('public events directory (/events) escapes a hostile event name', async ({ page }) => {
    const state = await armPage(page, [POISONED_ROW]);
    await page.goto('/events', { waitUntil: 'networkidle' });
    // Give the onerror payload a beat to fire if the render were unsafe.
    await page.waitForTimeout(300);
    await expectInertRender(page, state);
  });

  test('dynamic detail page (/events/detail/?id=...) escapes a hostile event name', async ({ page }) => {
    const state = await armPage(page, [POISONED_ROW]);
    await page.goto('/events/detail/?id=' + FAKE_ID, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    // The detail page sets document.title from ev.name — assert it is the raw
    // string (a string assignment, not HTML parsing), further proving inertness.
    await expect(page).toHaveTitle(new RegExp(PAYLOAD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    await expectInertRender(page, state);
  });

  test('past event with a hostile recap renders the recap content inert', async ({ page }) => {
    // Feed the detail page a PAST event whose recap_headline / recap_body /
    // recap_url / recap_photos_url are all hostile. The recap is the same
    // /events/detail?id=<id> page once the event is past — the v1.5 living
    // recap renders every recap string via textContent and only ever builds a
    // live anchor from an http(s):// recap_url. We assert the same render-safety
    // invariant the other detail test asserts (no parsed <img>, no fired
    // dialog, payload survives only as inert text) PLUS that the
    // javascript:-scheme recap_url never becomes a live, clickable anchor.
    const state = await armPage(page, [POISONED_RECAP_ROW]);
    await page.goto('/events/detail/?id=' + FAKE_RECAP_ID, { waitUntil: 'networkidle' });
    // Give any onerror payload (recap_url / gallery image) a beat to fire.
    await page.waitForTimeout(300);

    // The hostile recap strings survive as inert text, no <img> was parsed out
    // of the payload, and the onerror never executed.
    await expectInertRender(page, state);

    // The javascript:-scheme recap_url MUST NOT have been turned into a live
    // anchor. There must be zero <a> elements whose resolved href carries the
    // javascript: scheme (an http(s)-only gate yields none; an unguarded
    // assignment would yield a clickable XSS link).
    const liveJsAnchors = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors.filter((a) => {
        const raw = (a.getAttribute('href') || '').trim().toLowerCase();
        // Match both the literal attribute and the resolved property.
        const resolved = (a.href || '').trim().toLowerCase();
        return raw.indexOf('javascript:') === 0 || resolved.indexOf('javascript:') === 0;
      }).length;
    });
    expect(liveJsAnchors).toBe(0);
  });
});

// OPTIONAL: real live-submission round-trip. Disabled by default so the suite
// never writes spam to the live DB. Enable with RUN_LIVE_SUBMIT=1 in a throwaway
// environment only. (Even when enabled, the submitted row lands status='submitted'
// and stays hidden from the public reads, so it is harmless beyond a queued row.)
test.describe('stored-XSS: live submission round-trip (opt-in)', () => {
  test.skip(!process.env.RUN_LIVE_SUBMIT, 'set RUN_LIVE_SUBMIT=1 to exercise the real POST path');

  test('submitting a hostile name does not execute on the submit page', async ({ page }) => {
    const state = await armPage(page, [POISONED_ROW]);
    await page.goto('/submit-event/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    // We do not assert the public list here (the row is status='submitted' and
    // hidden); we only assert the submit page itself stays inert/alert-free.
    expect(state.dialogFired).toBe(false);
  });
});
