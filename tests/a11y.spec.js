// ===========================================================================
// Accessibility regression wall — Join modal + Start-a-Chapter form
// (v2.0.0 quality-wall exit criterion: "axe-core clean, keyboard-operable")
// ===========================================================================
// WHAT THIS GATES
// ---------------------------------------------------------------------------
// The two interactive surfaces a non-engineer most needs to be sure are
// accessible — because they are the conversion path (join a chapter) and the
// growth path (start a chapter):
//   1. The Start-a-Chapter form on /chapters (revealed by toggleStartForm()).
//   2. The Join modal on /chapters (opened by clicking a chapter card ->
//      openJoin()).
//
// THE STANDARD (per the council exit criterion)
// ---------------------------------------------------------------------------
//   * axe-core finds ZERO violations of impact serious/critical on each surface.
//   * Every interactive control in the surface is keyboard-focusable.
//   * Focused controls show a VISIBLE focus indicator (outline or box-shadow) —
//     a sighted keyboard user must always see where they are.
//   * The modal's controls (close button, inputs) carry an accessible name
//     (aria-label / associated <label> / non-empty text) so a screen reader
//     announces them.
//   * Content <img>s carry a non-empty alt; purely decorative images may use
//     alt="" (e.g. index.html's featured-bg backdrops sit behind a captioned
//     card and are correctly alt="").
//
// SCOPING (and why)
// ---------------------------------------------------------------------------
// axe is SCOPED with .include() to the component under test (the form card /
// the modal), not the whole document. The page also carries site-wide chrome
// (global nav, footer) whose a11y is owned by other surfaces; scoping keeps THIS
// wall focused on the two components this slice is chartered to gate, and keeps
// a failure message pointing at the exact component a non-engineer must fix.
// We still assert the document has a single <main> landmark separately (cheap,
// page-level, and a frequent regression) but do not let unrelated global-chrome
// findings mask a real modal/form regression.
//
// baseURL comes from playwright.config.js (BASE_URL env override; default prod).
// ===========================================================================

const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

const SERIOUS = new Set(['serious', 'critical']);

// Pretty one-liner per violation for actionable failure output.
function fmt(violations) {
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id} (${v.nodes.length} node${
          v.nodes.length === 1 ? '' : 's'
        }): ${v.help} — first: ${(v.nodes[0] && v.nodes[0].html
          ? v.nodes[0].html
          : ''
        ).slice(0, 120)}`
    )
    .join('\n  ');
}

// Run axe scoped to a selector and return only serious/critical violations.
async function scopedSeriousViolations(page, selector) {
  const results = await new AxeBuilder({ page }).include(selector).analyze();
  return results.violations.filter((v) => SERIOUS.has(v.impact));
}

// Assert every focusable control inside `selector` can take focus AND shows a
// visible focus indicator (non-`none` outline OR a box-shadow). Returns nothing;
// fails the test with a per-control message.
async function expectKeyboardOperable(page, selector, label) {
  const handles = await page.locator(`${selector} button, ${selector} a[href], ${selector} input, ${selector} textarea, ${selector} select`).elementHandles();
  expect(handles.length, `[${label}] no focusable controls found inside ${selector}`).toBeGreaterThan(0);
  for (const h of handles) {
    const probe = await h.evaluate((el) => {
      el.focus();
      const focused = document.activeElement === el;
      const s = getComputedStyle(el);
      const hasOutline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const hasShadow = s.boxShadow && s.boxShadow !== 'none';
      // Also accept a focus-visible border change as a valid indicator.
      const tag = el.tagName.toLowerCase();
      const name =
        el.getAttribute('aria-label') ||
        (el.id && (document.querySelector(`label[for="${el.id}"]`) || {}).textContent) ||
        (el.closest('label') ? el.closest('label').textContent : '') ||
        el.textContent ||
        el.getAttribute('placeholder') ||
        '';
      return { focused, hasOutline, hasShadow, tag, name: (name || '').trim().slice(0, 40), html: el.outerHTML.slice(0, 100) };
    });
    expect(probe.focused, `[${label}] control is not keyboard-focusable: ${probe.html}`).toBe(true);
    expect(
      probe.hasOutline || probe.hasShadow,
      `[${label}] focused control has NO visible focus indicator (outline:none, no box-shadow) — a keyboard user can't see focus: ${probe.html}`
    ).toBe(true);
    expect(
      probe.name.length,
      `[${label}] control has no accessible name (no aria-label / <label> / text): ${probe.html}`
    ).toBeGreaterThan(0);
  }
}

test.describe('a11y wall: Start-a-Chapter form (/chapters)', () => {
  test('form is axe-clean (no serious/critical) and keyboard-operable', async ({ page }) => {
    await page.goto('/chapters', { waitUntil: 'networkidle' });

    // Reveal the Start-a-Chapter form (toggleStartForm adds .open to the card).
    await page.evaluate(() => window.toggleStartForm && window.toggleStartForm());
    await expect(page.locator('#start-form-card.open')).toBeVisible();

    const violations = await scopedSeriousViolations(page, '#start-form-card');
    expect(
      violations.length,
      `Start-a-Chapter form has ${violations.length} serious/critical a11y violation(s):\n  ${fmt(violations)}`
    ).toBe(0);

    await expectKeyboardOperable(page, '#start-form-card', 'start-form');
  });
});

test.describe('a11y wall: Join modal (/chapters)', () => {
  test('modal is axe-clean (no serious/critical) and keyboard-operable', async ({ page }) => {
    await page.goto('/chapters', { waitUntil: 'networkidle' });

    // Open the Join modal by clicking the first chapter card (-> openJoin()).
    await page.waitForSelector('.chapter-card', { timeout: 10000 });
    await page.locator('.chapter-card').first().click();
    await expect(page.locator('#join-modal-overlay.open')).toBeVisible();

    // axe over the whole modal overlay (includes the close control).
    const violations = await scopedSeriousViolations(page, '#join-modal-overlay');
    expect(
      violations.length,
      `Join modal has ${violations.length} serious/critical a11y violation(s):\n  ${fmt(violations)}`
    ).toBe(0);

    await expectKeyboardOperable(page, '.join-modal', 'join-modal');

    // The close control must carry an accessible name (its visible glyph is only
    // "×", which a screen reader cannot meaningfully announce on its own).
    const closeName = await page.locator('.join-modal-close').first().evaluate((el) => {
      return (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
    });
    expect(
      /close|cancel|dismiss/i.test(closeName),
      `Join modal close button needs an accessible name like aria-label="Close" (found: "${closeName}")`
    ).toBe(true);
  });
});

test.describe('a11y wall: page-level invariants on /chapters', () => {
  test('exactly one <main> landmark and all content images carry alt text', async ({ page }) => {
    await page.goto('/chapters', { waitUntil: 'networkidle' });

    // Single main landmark — a frequent, screen-reader-impacting regression.
    const mainCount = await page.locator('main, [role="main"]').count();
    expect(
      mainCount,
      `/chapters should expose exactly one <main> landmark (found ${mainCount}); screen-reader users rely on it to skip to content`
    ).toBe(1);

    // Content images must have a non-empty alt. Decorative images may use alt=""
    // (we treat alt="" or role="presentation"/"none" as an intentional opt-out).
    const badImgs = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .filter((img) => {
          const role = (img.getAttribute('role') || '').toLowerCase();
          const decorative = img.getAttribute('alt') === '' || role === 'presentation' || role === 'none';
          if (decorative) return false; // explicitly decorative — allowed.
          const alt = (img.getAttribute('alt') || '').trim();
          return alt.length === 0; // missing/blank alt on a non-decorative image.
        })
        .map((img) => (img.getAttribute('src') || '(no src)').slice(0, 80));
    });
    expect(
      badImgs,
      `content image(s) on /chapters are missing alt text (set a descriptive alt, or alt="" if truly decorative): ${badImgs.join(', ')}`
    ).toEqual([]);
  });
});
