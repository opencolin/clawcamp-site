// ClawCamp — Captain's Console (v1.4 RBAC; v2.0 health + directory).
//
// A SELF-CONTAINED dashboard module. It mounts into #captains-console-root
// (created by the dashboard slice). If that element is absent it NO-OPS
// silently, so the dashboard never regresses before this ships.
//
// v2.0 ADDS two PRIVATE captain/admin-only sections per captained chapter,
// rendered on the SAME gated path as the roster (renderChapterConsole):
//   * renderHealth()    — a PRIVATE momentum dashboard (follower growth, RSVP
//     conversion, attendance trend) framed as "your city is forming", NEVER a
//     cross-chapter leaderboard. Reads the chapter_stats VIEW (counts only — no
//     roster leak).
//   * renderDirectory() — an OPT-IN member directory (PII-free @username/photo/
//     bio) read from a chapter_directory VIEW filtered to profiles that opted in
//     (profiles.is_public). It NEVER lists non-opted-in members.
// BOTH degrade to a NO-OP / opt-in empty state when their stat source / view /
// column is absent (the provisioning migration 0009 — see the RUNBOOK note at
// the BOTTOM of this file), exactly like the memberships-404 fallback, so the
// dashboard never regresses before migrations are applied.
//
// SECURITY MODEL — read this before touching anything:
//   The AUTHORITATIVE gate is RLS (migration 0006, rbac-data-spine slice):
//     * chapters_update_captain        — a captain may PATCH only their chapter
//     * events_update_admin_or_captain — approve/reject only for owned chapters
//     * rsvps_select_captain           — read the roster only for owned chapters
//   Everything this file does is COSMETIC: it decides what to *render*. A user
//   who bypasses this JS still cannot edit another chapter, moderate another
//   chapter's events, or read another chapter's roster — every such request is
//   rejected server-side by RLS. This mirrors admin/index.html's ADMIN_EMAILS
//   comment: client role checks are UX only, never a security boundary.
//
// STORED-XSS INVARIANT (locked by tests/xss.spec.js):
//   EVERY event/chapter/RSVP field is untrusted user content and is written
//   via document.createElement + textContent — NEVER innerHTML. Submitted URLs
//   render as inert text (no anchor), exactly like admin/index.html renderCard.
//
// GRACEFUL FALLBACK everywhere: if the memberships table is absent (404), the
// user captains nothing, or any read errors, we render NOTHING and return.
(function () {
  'use strict';

  var ROOT_ID = 'captains-console-root';

  // ---------------------------------------------------------------------------
  // Config + session-bound fetch.
  // We implement our OWN authFetch (cloned from dashboard's dashAuthFetch /
  // admin's authFetch) so this module does NOT depend on any dashboard-internal
  // function. PostgREST needs the anon key in `apikey`; the logged-in user's
  // JWT rides in `Authorization`. Resolves to null when there is no session so
  // every caller can no-op. The session JWT is what lets the 0006 RLS policies
  // match the caller's captain/admin membership server-side.
  // ---------------------------------------------------------------------------
  var CONFIG = window.CLAWCAMP_CONFIG || {};
  var SUPABASE_URL = CONFIG.SUPABASE_URL;
  var SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

  function authFetch(url, opts) {
    opts = opts || {};
    if (!window.clawAuth || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return Promise.resolve(null);
    }
    return window.clawAuth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) return null; // no session -> caller must no-op
      var headers = {};
      var src = opts.headers || {};
      for (var k in src) { if (src.hasOwnProperty(k)) headers[k] = src[k]; }
      headers.apikey = SUPABASE_ANON_KEY;
      headers.Authorization = 'Bearer ' + session.access_token;
      var merged = {};
      for (var o in opts) { if (opts.hasOwnProperty(o)) merged[o] = opts[o]; }
      merged.headers = headers;
      return fetch(url, merged);
    }).catch(function () { return null; });
  }

  // ---------------------------------------------------------------------------
  // Small DOM + format helpers (all textContent-based — the XSS invariant).
  // ---------------------------------------------------------------------------
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function fmtDate(dateStr) {
    if (!dateStr) return 'Date TBD';
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) {
      // Could be a full timestamptz (created_at) — try the raw value.
      d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
    }
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function fmtTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  // Today's date as a YYYY-MM-DD string, computed exactly like the public event
  // detail page (events/detail/index.html) so "past" means the same thing in
  // both places. A string compare against event_date (also YYYY-MM-DD) is safe.
  function todayStr() {
    var t = new Date();
    return t.getFullYear() + '-' +
      String(t.getMonth() + 1).padStart(2, '0') + '-' +
      String(t.getDate()).padStart(2, '0');
  }

  function isPastEvent(event) {
    return !!(event && event.event_date && event.event_date < todayStr());
  }

  // MIME -> file extension for recap photo uploads. Mirrors the dashboard's
  // extForType map (the 'media' bucket also enforces mime + size server-side as
  // the real gate); an unsupported type returns '' so we can bail before Storage.
  function extForType(type) {
    var map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
    return map[type] || '';
  }

  // Human label for an event status (badge text).
  function statusLabel(status) {
    switch (status) {
      case 'submitted': return 'Pending review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected / cancelled';
      case 'draft': return 'Draft';
      default: return status || 'Unknown';
    }
  }

  // ---------------------------------------------------------------------------
  // CSV (RFC 4180) — built entirely CLIENT-SIDE from the fetched roster rows.
  // Fields containing a comma, double-quote, CR or LF are wrapped in double
  // quotes and embedded quotes are doubled. CRLF row terminators per the spec.
  // ---------------------------------------------------------------------------
  function csvField(value) {
    var s = (value == null) ? '' : String(value);
    if (/[",\r\n]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function buildCsv(rows) {
    var header = ['name', 'email', 'status', 'created_at'];
    var lines = [header.join(',')];
    (rows || []).forEach(function (r) {
      lines.push([
        csvField(r.name),
        csvField(r.email),
        csvField(r.status),
        csvField(r.created_at)
      ].join(','));
    });
    return lines.join('\r\n');
  }

  // Trigger a client-side download via a Blob + object URL on a programmatically
  // created <a download>. The URL is revoked right after to avoid a leak.
  function downloadCsv(filename, csv) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke so the click has a chance to start the download.
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  // A safe filename slug from the chapter slug or event id.
  function safeSlug(s) {
    return String(s || 'chapter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'chapter';
  }

  // ---------------------------------------------------------------------------
  // FEATURE 1 — Edit own chapter (name/city/blurb/emoji, the 0002 columns).
  // PATCH /rest/v1/chapters?id=eq.<id> with Prefer: return=minimal. The
  // chapters_update_captain policy (0006) authorizes this ONLY for the captain
  // of that chapter; a cross-chapter PATCH is rejected server-side.
  // ---------------------------------------------------------------------------
  function renderChapterEditor(chapter) {
    var section = el('div', 'cc-block');
    section.appendChild(el('div', 'cc-block-title', 'Chapter details'));

    var form = el('div', 'cc-form');

    var fields = [
      { key: 'emoji', label: 'Emoji', type: 'text', value: chapter.emoji || '', placeholder: '🦞' },
      { key: 'name', label: 'Name', type: 'text', value: chapter.name || '', placeholder: 'ClawCamp City' },
      { key: 'city', label: 'City', type: 'text', value: chapter.city || '', placeholder: 'City, Region' },
      { key: 'blurb', label: 'Blurb', type: 'textarea', value: chapter.blurb || '', placeholder: 'A short description shown on the chapter card.' }
    ];

    var inputs = {};
    fields.forEach(function (f) {
      var field = el('div', 'cc-field');
      field.appendChild(el('label', 'cc-label', f.label));
      var input;
      if (f.type === 'textarea') {
        input = el('textarea', 'cc-input cc-textarea');
        input.rows = 3;
      } else {
        input = el('input', 'cc-input');
        input.type = 'text';
      }
      input.value = f.value;
      input.placeholder = f.placeholder;
      field.appendChild(input);
      form.appendChild(field);
      inputs[f.key] = input;
    });

    var saveRow = el('div', 'cc-save-row');
    var saveBtn = el('button', 'cc-btn cc-btn-primary', 'Save chapter');
    var statusEl = el('span', 'cc-status');
    saveRow.appendChild(saveBtn);
    saveRow.appendChild(statusEl);
    form.appendChild(saveRow);

    function setStatus(msg, kind) {
      statusEl.textContent = msg || '';
      statusEl.style.color = kind === 'error' ? '#c62828'
        : kind === 'ok' ? '#2d4a2f' : 'var(--muted)';
    }

    saveBtn.addEventListener('click', function () {
      var body = {
        emoji: inputs.emoji.value.trim() || null,
        name: inputs.name.value.trim(),
        city: inputs.city.value.trim() || null,
        blurb: inputs.blurb.value.trim() || null
      };
      if (!body.name) { setStatus('Name can’t be empty.', 'error'); return; }
      saveBtn.disabled = true;
      setStatus('Saving…', null);
      // Authoritative gate is RLS: this PATCH only succeeds for the captain of
      // this chapter. return=minimal — we don't need the row back.
      authFetch(SUPABASE_URL + '/rest/v1/chapters?id=eq.' + encodeURIComponent(chapter.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(body)
      }).then(function (r) {
        saveBtn.disabled = false;
        if (r && r.ok) {
          setStatus('Saved ✓', 'ok');
          // Reflect the saved values back into our in-memory chapter + header.
          chapter.name = body.name;
          chapter.city = body.city;
          chapter.blurb = body.blurb;
          chapter.emoji = body.emoji;
          setTimeout(function () {
            if (statusEl.textContent === 'Saved ✓') setStatus('', null);
          }, 3000);
        } else {
          setStatus('Couldn’t save. You may not have access to this chapter.', 'error');
        }
      }).catch(function () {
        saveBtn.disabled = false;
        setStatus('Couldn’t save. Try again.', 'error');
      });
    });

    section.appendChild(form);
    return section;
  }

  // ---------------------------------------------------------------------------
  // FEATURE 3 — RSVP roster + headcount + CSV (door check-in).
  // GET /rest/v1/rsvps?...&event_id=eq.<id>. Rows come back ONLY because
  // rsvps_select_captain (0006) grants a captain read of their own chapter's
  // roster — anon/other users get nothing. Roster + health stats are PRIVATE/
  // captain-only by default (no public leaderboard — council note).
  // ---------------------------------------------------------------------------
  function renderRoster(event, container) {
    container.textContent = '';
    container.appendChild(el('div', 'cc-roster-loading', 'Loading RSVPs…'));

    authFetch(SUPABASE_URL + '/rest/v1/rsvps?select=name,email,status,created_at' +
      '&event_id=eq.' + encodeURIComponent(event.id) + '&order=created_at.asc', {
      headers: {}
    }).then(function (r) {
      if (!r || r.status === 404 || !r.ok) return null; // graceful: no roster access / table absent
      return r.json();
    }).then(function (rows) {
      container.textContent = '';
      if (!rows || !rows.length) {
        container.appendChild(el('div', 'cc-roster-empty', 'No RSVPs yet.'));
        return;
      }

      // Headcount vs capacity. Cancelled rows don't count toward the headcount.
      var going = 0, waitlist = 0;
      rows.forEach(function (rsvp) {
        if (rsvp.status === 'going') going++;
        else if (rsvp.status === 'waitlist') waitlist++;
      });

      var cap = (event.capacity == null) ? null : Number(event.capacity);
      var badge = el('div', 'cc-headcount');
      var goingBadge = el('span', 'cc-badge cc-badge-going');
      if (cap == null) {
        goingBadge.textContent = going + ' going';
      } else {
        goingBadge.textContent = going + ' going / ' + cap + ' capacity';
        if (going > cap) goingBadge.className = 'cc-badge cc-badge-over';
      }
      badge.appendChild(goingBadge);
      if (waitlist > 0) {
        badge.appendChild(el('span', 'cc-badge cc-badge-waitlist', waitlist + ' waitlist'));
      }
      // Over-capacity context for the waitlist (when a capacity is set).
      if (cap != null && going > cap) {
        badge.appendChild(el('span', 'cc-badge-note', 'Over capacity — newest RSVPs may belong on the waitlist.'));
      }
      container.appendChild(badge);

      // Export CSV button (door check-in). CSV is built client-side from the
      // exact rows we just fetched (header: name,email,status,created_at).
      var exportRow = el('div', 'cc-export-row');
      var exportBtn = el('button', 'cc-btn cc-btn-ghost', '⬇ Export CSV');
      exportBtn.addEventListener('click', function () {
        var csv = buildCsv(rows);
        downloadCsv('clawcamp-rsvps-' + safeSlug(event.name || event.id) + '.csv', csv);
      });
      exportRow.appendChild(exportBtn);
      container.appendChild(exportRow);

      // Roster table — every cell is untrusted PII rendered via textContent.
      var table = el('table', 'cc-roster-table');
      var thead = el('thead');
      var hrow = el('tr');
      ['Name', 'Email', 'Status', 'RSVP’d'].forEach(function (h) {
        hrow.appendChild(el('th', null, h));
      });
      thead.appendChild(hrow);
      table.appendChild(thead);

      var tbody = el('tbody');
      rows.forEach(function (rsvp) {
        var tr = el('tr');
        if (rsvp.status === 'cancelled') tr.className = 'cc-row-cancelled';
        tr.appendChild(el('td', null, rsvp.name || '—'));
        tr.appendChild(el('td', 'cc-cell-email', rsvp.email || '—'));
        tr.appendChild(el('td', null, rsvp.status || '—'));
        tr.appendChild(el('td', 'cc-cell-time', fmtTimestamp(rsvp.created_at)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }).catch(function () {
      container.textContent = '';
      container.appendChild(el('div', 'cc-roster-empty', 'No RSVPs yet.'));
    });
  }

  // ---------------------------------------------------------------------------
  // Number helpers for the health panel — coerce a value to a non-negative
  // integer (NaN/null -> null so we can render an em-dash for "not available"),
  // and a whole-percent string from a numerator/denominator.
  // ---------------------------------------------------------------------------
  function intOrNull(v) {
    if (v == null) return null;
    var n = Number(v);
    if (!isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }
  function pctOf(part, whole) {
    if (whole == null || whole <= 0 || part == null) return null;
    return Math.round((part / whole) * 100);
  }

  // ---------------------------------------------------------------------------
  // FEATURE 5 — PRIVATE captain health dashboard ("your city is forming").
  //
  // Rendered ONLY on the captain/admin console path that already gates the
  // roster (renderChapterConsole) — there is NO public surface for these numbers.
  // This is INTENTIONALLY framed as momentum for THIS chapter ("X new followers
  // this month", "X% of followers RSVP'd") and NEVER as a leaderboard or a
  // cross-chapter ranking (council note: a public ranking demoralizes small/new
  // chapters — health stays private + non-comparative).
  //
  // DATA SOURCE: the chapter_stats VIEW (anon/auth-readable aggregate; a VIEW
  // runs with its owner's privileges, so reading it exposes COUNTS only and
  // never the sealed rsvps/chapter_follows rosters — the same PII-safe pattern
  // the public chapter cards use). We read it with authFetch and filter to this
  // chapter by id.
  //   * total_attendees / events_hosted ship in migration 0008.
  //   * followers + new_followers_30d are EXPECTED from the provisioning
  //     migration (0009) — see the RUNBOOK note at the bottom of this file. Until
  //     0009 is applied those columns come back undefined; we render an em-dash
  //     for any missing stat and SKIP the derived "conversion"/"growth" lines,
  //     never showing a wrong or zero-divided number.
  //
  // GRACEFUL FALLBACK: if chapter_stats 404s (view absent), the read errors, or
  // no row comes back, the whole panel NO-OPs (renders nothing) — exactly like
  // the module's memberships-404 fallback, so the console never regresses.
  // Every number is written via textContent (the XSS invariant), though these
  // are DB-derived integers, not user free-text.
  // ---------------------------------------------------------------------------
  function renderHealth(chapter, block) {
    // `block` is a pre-positioned, EMPTY .cc-block appended synchronously by the
    // caller (so it keeps its top-of-panel position + correct :first-of-type
    // border). We fill it async; on 404/error/no-row we REMOVE it so an absent
    // migration leaves no empty section behind (graceful NO-OP).
    function noop() {
      if (block && block.parentNode) block.parentNode.removeChild(block);
    }

    // chapter_stats columns: id, slug, upcoming_events, total_events,
    // events_hosted, total_attendees (0008) + followers, new_followers_30d (0009).
    // select=* so newly-added columns ride along without a code change; we never
    // 400 on an unknown column because we ask for everything.
    authFetch(SUPABASE_URL + '/rest/v1/chapter_stats?select=*' +
      '&id=eq.' + encodeURIComponent(chapter.id) + '&limit=1', {
      headers: {}
    }).then(function (r) {
      if (!r || r.status === 404 || !r.ok) return null; // view absent / no access
      return r.json();
    }).then(function (rows) {
      if (!rows || !rows.length) { noop(); return; } // no stats row -> remove slot
      var s = rows[0];

      var followers = intOrNull(s.followers);
      var newFollowers = intOrNull(s.new_followers_30d);
      var attendees = intOrNull(s.total_attendees);
      var hosted = intOrNull(s.events_hosted);

      block.appendChild(el('div', 'cc-block-title', 'Chapter momentum'));
      block.appendChild(el('div', 'cc-health-lede',
        'A private snapshot of how your city is forming. Only you (and ClawCamp ' +
        'admins) can see this — it’s not a ranking.'));

      var grid = el('div', 'cc-health-grid');

      // A stat tile: a big number (or em-dash) + a label + optional sub-note.
      function tile(value, label, note) {
        var t = el('div', 'cc-health-tile');
        t.appendChild(el('div', 'cc-health-num', value == null ? '—' : String(value)));
        t.appendChild(el('div', 'cc-health-label', label));
        if (note) t.appendChild(el('div', 'cc-health-note', note));
        return t;
      }

      // Follower growth — total followers + "this month" momentum sub-note.
      var growthNote = null;
      if (newFollowers != null) {
        growthNote = (newFollowers === 0)
          ? 'No new followers this month yet'
          : ('+' + newFollowers + (newFollowers === 1 ? ' new follower' : ' new followers') + ' this month');
      }
      grid.appendChild(tile(followers, 'followers', growthNote));

      // RSVP conversion — going|waitlist attendees as a share of followers
      // (a proxy for "how many of the people who follow you actually show up").
      // Only shown when we have BOTH a follower count > 0 and an attendee count,
      // so we never divide by zero or imply 0% from missing data.
      var conv = pctOf(attendees, followers);
      grid.appendChild(tile(
        conv == null ? null : conv + '%',
        'RSVP conversion',
        conv == null ? null : (attendees + ' RSVPs across ' + followers + ' followers')
      ));

      // Attendance trend — events actually hosted + the total people who came.
      grid.appendChild(tile(hosted, 'events hosted',
        attendees == null ? null
          : (attendees + (attendees === 1 ? ' attendee' : ' attendees') + ' all-time')));

      block.appendChild(grid);
    }).catch(function () { noop(); });
  }

  // ---------------------------------------------------------------------------
  // FEATURE 6 — OPT-IN per-chapter member directory ("turning chapters into
  // networks"). Rendered on the captain/admin console panel.
  //
  // OPT-IN IS NON-NEGOTIABLE: we render ONLY profiles that explicitly opted into
  // the directory. We read a dedicated chapter_directory VIEW that JOINs this
  // chapter's followers/members to profiles and exposes ONLY PII-FREE public
  // profile fields (username / photo_path / bio / display_name) for rows whose
  // profile set the opt-in flag (profiles.is_public = true). We do NOT read
  // chapter_follows + profiles directly here, because (a) the captain's
  // chapter_follows RLS is select-OWN-only (0007) so it wouldn't list other
  // members anyway, and (b) joining raw follows would risk listing people who
  // never opted in. The VIEW (owner-privileged, opt-in-filtered, PII-free) is
  // the correct surface.
  //
  // PROVISIONING DEPENDENCY (see the RUNBOOK note at the bottom of this file):
  // chapter_directory + the profiles.is_public opt-in column are EXPECTED from
  // migration 0009. Until that is applied the view 404s and we show the
  // 'No members have opted in yet' EMPTY STATE — we NEVER fall back to listing
  // everyone (that would leak non-opted-in members). The empty state is also
  // what shows when the view exists but nobody has opted in yet.
  //
  // XSS: @username, the photo's alt text, and bio are all untrusted user content
  // rendered via el()/textContent and img.src/img.alt — NEVER innerHTML. The
  // photo URL is derived client-side from a trusted 'media' bucket path (same as
  // the dashboard avatar + recap gallery), not injected as markup.
  // ---------------------------------------------------------------------------
  function renderDirectory(chapter, container) {
    var block = el('div', 'cc-block cc-directory');
    block.appendChild(el('div', 'cc-block-title', 'Member directory'));
    block.appendChild(el('div', 'cc-directory-lede',
      'Members who opted in to your chapter directory. Members control this from ' +
      'their dashboard profile.'));
    var listEl = el('div', 'cc-directory-list');
    listEl.appendChild(el('div', 'cc-roster-loading', 'Loading directory…'));
    block.appendChild(listEl);
    container.appendChild(block);

    function empty() {
      listEl.textContent = '';
      listEl.appendChild(el('div', 'cc-directory-empty', 'No members have opted in yet.'));
    }

    // chapter_directory exposes (at least): chapter_id, username, display_name,
    // bio, photo_path — opt-in-filtered + PII-free. select=* so the view can add
    // columns without a code change. If the view is absent (404) or errors, we
    // show the SAME opt-in empty state (never a leak).
    authFetch(SUPABASE_URL + '/rest/v1/chapter_directory?select=*' +
      '&chapter_id=eq.' + encodeURIComponent(chapter.id) +
      '&order=username.asc&limit=200', {
      headers: {}
    }).then(function (r) {
      if (!r || r.status === 404 || !r.ok) return null; // view absent / no access -> empty state
      return r.json();
    }).then(function (rows) {
      if (rows === null) { empty(); return; }
      if (!rows.length) { empty(); return; }

      listEl.textContent = '';
      var grid = el('div', 'cc-directory-grid');
      rows.forEach(function (m) {
        var card = el('div', 'cc-member-card');

        // Avatar: derive a public URL from the trusted media-bucket path. Falls
        // back to initials when no photo / SDK unavailable. alt text = username
        // (untrusted -> set via .alt, which is attribute-safe, not markup).
        var avatar = el('div', 'cc-member-avatar');
        var handle = (typeof m.username === 'string' && m.username) ? m.username : '';
        var photoUrl = null;
        if (typeof m.photo_path === 'string' && m.photo_path) {
          try {
            var client = window.clawAuth && window.clawAuth.client;
            if (client && client.storage) {
              var pub = client.storage.from('media').getPublicUrl(m.photo_path);
              photoUrl = pub && pub.data && pub.data.publicUrl;
            }
          } catch (e) { photoUrl = null; }
        }
        if (photoUrl) {
          var img = document.createElement('img');
          img.src = photoUrl;
          img.alt = handle ? ('@' + handle) : 'Member photo';
          img.loading = 'lazy';
          avatar.appendChild(img);
        } else {
          // Initials from display name or handle (textContent — safe).
          var basis = (typeof m.display_name === 'string' && m.display_name) ? m.display_name : handle;
          var initials = basis
            ? basis.split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toUpperCase()
            : '?';
          avatar.textContent = initials || '?';
        }
        card.appendChild(avatar);

        var info = el('div', 'cc-member-info');
        // Display name (optional) then the @handle.
        if (typeof m.display_name === 'string' && m.display_name) {
          info.appendChild(el('div', 'cc-member-name', m.display_name));
        }
        if (handle) {
          info.appendChild(el('div', 'cc-member-handle', '@' + handle));
        } else if (!(typeof m.display_name === 'string' && m.display_name)) {
          // Neither a name nor a handle — show a neutral placeholder rather than blank.
          info.appendChild(el('div', 'cc-member-name', 'Member'));
        }
        // Bio (optional) — untrusted; textContent only.
        if (typeof m.bio === 'string' && m.bio) {
          info.appendChild(el('div', 'cc-member-bio', m.bio));
        }
        card.appendChild(info);
        grid.appendChild(card);
      });
      listEl.appendChild(grid);
    }).catch(function () { empty(); });
  }

  // ---------------------------------------------------------------------------
  // FEATURE 2 — Moderate this chapter's events.
  // Per-chapter review is the PRIMARY path (global /admin is the fallback for
  // unclaimed events). Approve/Reject reuse the EXACT busy-state UX from
  // admin/index.html. These PATCHes succeed ONLY via events_update_admin_or_
  // captain (0006) AND only for events whose chapter_id the caller captains —
  // an attempt on another chapter's event is rejected by RLS (headline exit
  // criterion). Every field is rendered via textContent (XSS invariant).
  // ---------------------------------------------------------------------------
  function renderEventCard(event, chapter, onChanged) {
    var card = el('div', 'cc-event-card');
    card.setAttribute('data-event-id', String(event.id));

    var head = el('div', 'cc-event-head');
    var name = el('div', 'cc-event-name', event.name || '(untitled event)');
    head.appendChild(name);
    var badge = el('span', 'cc-event-badge cc-status-' + (event.status || 'unknown'), statusLabel(event.status));
    head.appendChild(badge);
    card.appendChild(head);

    var meta = el('div', 'cc-event-meta');
    meta.appendChild(el('span', null, '📅 ' + fmtDate(event.event_date)));
    if (event.city) meta.appendChild(el('span', null, '📍 ' + event.city));
    card.appendChild(meta);

    if (event.description) {
      card.appendChild(el('div', 'cc-event-desc', event.description));
    }

    if (event.link) {
      // Inert text, NOT an anchor — an untrusted href could carry a javascript:
      // or data: scheme (admin/index.html does the same).
      card.appendChild(el('div', 'cc-event-link', event.link));
    }

    var actions = el('div', 'cc-event-actions');
    var statusEl = el('div', 'cc-status');

    function setBusy(busy, msg, kind) {
      Array.prototype.forEach.call(actions.querySelectorAll('button'), function (b) {
        b.disabled = busy;
      });
      statusEl.textContent = msg || '';
      statusEl.style.color = kind === 'error' ? '#c62828'
        : kind === 'ok' ? '#2d4a2f' : 'var(--muted)';
    }

    function patchStatus(payload, pendingMsg, failMsg) {
      setBusy(true, pendingMsg, null);
      authFetch(SUPABASE_URL + '/rest/v1/events?id=eq.' + encodeURIComponent(event.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (r && r.ok) {
          if (typeof onChanged === 'function') onChanged();
        } else {
          setBusy(false, failMsg, 'error');
        }
      }).catch(function () {
        setBusy(false, failMsg, 'error');
      });
    }

    if (event.status === 'submitted') {
      var approveBtn = el('button', 'cc-btn cc-btn-approve', 'Approve');
      approveBtn.addEventListener('click', function () {
        patchStatus({ status: 'approved' }, 'Approving…', 'Could not approve. Try again.');
      });
      var rejectBtn = el('button', 'cc-btn cc-btn-reject', 'Reject');
      rejectBtn.addEventListener('click', function () {
        var reason = window.prompt('Rejection reason (saved to the reviewer notes field):', '');
        if (reason === null) return; // cancelled
        patchStatus({ status: 'rejected', notes: reason }, 'Rejecting…', 'Could not reject. Try again.');
      });
      actions.appendChild(approveBtn);
      actions.appendChild(rejectBtn);
    }

    if (event.status === 'approved' || event.status === 'draft') {
      // View / edit deep-links into the existing 4-tab submit-event form by id
      // (the reuse target named in the plan — we do NOT duplicate that form).
      var editLink = el('a', 'cc-btn cc-btn-ghost', 'View / edit');
      editLink.href = '/submit-event/?id=' + encodeURIComponent(event.id);
      actions.appendChild(editLink);

      // Cancel affordance: PATCH status to 'rejected' (canceled) behind a
      // confirm. RLS still gates this to captains of this chapter.
      var cancelBtn = el('button', 'cc-btn cc-btn-reject', 'Cancel event');
      cancelBtn.addEventListener('click', function () {
        if (!window.confirm('Cancel this event? It will be hidden from the public listing.')) return;
        patchStatus({ status: 'rejected' }, 'Cancelling…', 'Could not cancel. Try again.');
      });
      actions.appendChild(cancelBtn);
    }

    if (actions.childNodes.length) card.appendChild(actions);
    card.appendChild(statusEl);

    // RSVP roster (collapsible) — shown for every event in the chapter.
    var rosterWrap = el('div', 'cc-roster-wrap');
    var rosterToggle = el('button', 'cc-roster-toggle', '▸ RSVP roster & headcount');
    var rosterBody = el('div', 'cc-roster-body');
    rosterBody.style.display = 'none';
    var loaded = false;
    rosterToggle.addEventListener('click', function () {
      var open = rosterBody.style.display !== 'none';
      if (open) {
        rosterBody.style.display = 'none';
        rosterToggle.textContent = '▸ RSVP roster & headcount';
      } else {
        rosterBody.style.display = '';
        rosterToggle.textContent = '▾ RSVP roster & headcount';
        if (!loaded) { loaded = true; renderRoster(event, rosterBody); }
      }
    });
    rosterWrap.appendChild(rosterToggle);
    rosterWrap.appendChild(rosterBody);
    card.appendChild(rosterWrap);

    // Recap composer (collapsible) — only for PAST events. Upcoming events get
    // nothing new here. Mirrors the roster toggle pattern above.
    if (isPastEvent(event)) {
      card.appendChild(renderRecapComposer(event, chapter, onChanged));
    }

    return card;
  }

  // ---------------------------------------------------------------------------
  // FEATURE 4 — Recap composer (authoring counterpart to the public detail-page
  // recap section). Lets a captain attach uploaded photos, a recording/slides
  // URL, a headline, and takeaways to a PAST event in THEIR chapter.
  //
  // DEPENDS ON migration 0008 (recap_* columns + a per-chapter storage INSERT
  // policy) but DEGRADES GRACEFULLY when absent: the SELECT falls back (no
  // prefill), an upload against a missing bucket/policy surfaces an inline
  // error and the rest of the composer stays usable, and a SAVE PATCH against
  // missing columns just shows the friendly access error.
  //
  // SECURITY: identical posture to the rest of this file. The AUTHORITATIVE
  // gate is RLS — the per-chapter Storage INSERT policy (0008) authorizes the
  // upload ONLY for a captain of THIS chapter (a cross-chapter path is rejected
  // server-side), and events_update_admin_or_captain (0006) authorizes the
  // PATCH only for the captain of the event's chapter. Every field is rendered
  // via el()/textContent — NEVER innerHTML (STORED-XSS INVARIANT).
  // ---------------------------------------------------------------------------
  function renderRecapComposer(event, chapter, onChanged) {
    // Existing recap photo PATHS already on the event (from the widened SELECT).
    // We MERGE newly-uploaded paths into this so re-saving never drops photos.
    var existingPhotos = Array.isArray(event.recap_photos_url) ? event.recap_photos_url.slice() : [];

    var wrap = el('div', 'cc-recap-wrap');
    var toggle = el('button', 'cc-recap-toggle', '▸ Recap');
    var body = el('div', 'cc-recap-body');
    body.style.display = 'none';
    toggle.addEventListener('click', function () {
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      toggle.textContent = (open ? '▸' : '▾') + ' Recap';
    });
    wrap.appendChild(toggle);
    wrap.appendChild(body);

    var form = el('div', 'cc-recap-form');

    // --- Recording / slides URL ---
    var urlField = el('div', 'cc-field');
    urlField.appendChild(el('label', 'cc-label', 'Recording / slides URL'));
    var urlInput = el('input', 'cc-input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://…';
    urlInput.value = event.recap_url || '';
    urlField.appendChild(urlInput);
    form.appendChild(urlField);

    // --- Headline ---
    var headlineField = el('div', 'cc-field');
    headlineField.appendChild(el('label', 'cc-label', 'Headline'));
    var headlineInput = el('input', 'cc-input');
    headlineInput.type = 'text';
    headlineInput.placeholder = 'A one-line recap headline.';
    headlineInput.value = event.recap_headline || '';
    headlineField.appendChild(headlineInput);
    form.appendChild(headlineField);

    // --- Body / takeaways ---
    var bodyField = el('div', 'cc-field');
    bodyField.appendChild(el('label', 'cc-label', 'Takeaways'));
    var bodyInput = el('textarea', 'cc-input cc-textarea');
    bodyInput.rows = 4;
    bodyInput.placeholder = 'Headline takeaways from the event.';
    bodyInput.value = event.recap_body || '';
    bodyField.appendChild(bodyInput);
    form.appendChild(bodyField);

    // --- Photos (multiple) ---
    var photoField = el('div', 'cc-field');
    photoField.appendChild(el('label', 'cc-label', 'Photos'));
    var photoInput = el('input', 'cc-recap-file');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.multiple = true;
    photoField.appendChild(photoInput);
    // A small count of photos already attached (rendered as plain text).
    var photoCount = el('div', 'cc-recap-photocount');
    function refreshPhotoCount() {
      var n = existingPhotos.length;
      photoCount.textContent = n
        ? (n + (n === 1 ? ' photo attached' : ' photos attached'))
        : 'No photos attached yet.';
    }
    refreshPhotoCount();
    photoField.appendChild(photoCount);
    form.appendChild(photoField);

    // --- Save row + status ---
    var saveRow = el('div', 'cc-save-row');
    var saveBtn = el('button', 'cc-btn cc-btn-primary', 'Save recap');
    var statusEl = el('span', 'cc-status');
    saveRow.appendChild(saveBtn);
    saveRow.appendChild(statusEl);
    form.appendChild(saveRow);

    function setStatus(msg, kind) {
      statusEl.textContent = msg || '';
      statusEl.style.color = kind === 'error' ? '#c62828'
        : kind === 'ok' ? '#2d4a2f' : 'var(--muted)';
    }

    // Upload each selected file to the 'media' bucket under the CHAPTER folder
    // (NOT the user folder). The 0008 per-chapter INSERT policy authorizes this
    // ONLY for a captain of THIS chapter — a cross-chapter upload is rejected
    // server-side, so we never rely on the client for that boundary. Resolves
    // to an array of uploaded object PATHS (not public URLs). Bails on an
    // unsupported MIME before hitting Storage; enforces the 5MB client check
    // (the bucket also enforces size + mime server-side as the real gate).
    function uploadPhotos(files) {
      var client = window.clawAuth && window.clawAuth.client;
      if (!client || !client.storage) {
        return Promise.reject(new Error('storage-unavailable'));
      }
      var uploads = [];
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          return Promise.reject(new Error('too-large'));
        }
        var ext = extForType(file.type);
        if (!ext) {
          return Promise.reject(new Error('bad-type'));
        }
        var path = 'chapter-' + chapter.id + '/recap-' + event.id + '-' + Date.now() + '-' + i + '.' + ext;
        uploads.push(
          client.storage.from('media').upload(path, file, { contentType: file.type })
            .then(function (boundPath) {
              return function (up) {
                if (!up || up.error) throw (up && up.error) || new Error('upload-failed');
                return boundPath;
              };
            }(path))
        );
      }
      return Promise.all(uploads);
    }

    saveBtn.addEventListener('click', function () {
      saveBtn.disabled = true;
      var files = (photoInput.files && photoInput.files.length) ? photoInput.files : null;

      var ready = files
        ? (setStatus('Uploading photos…', null), uploadPhotos(files))
        : Promise.resolve([]);

      ready.then(function (newPaths) {
        // Merge newly-uploaded paths with any already on the event so a
        // re-save never drops existing photos.
        var photos = existingPhotos.concat(newPaths || []);
        setStatus('Saving…', null);
        // Same PATCH shape patchStatus() uses (Content-Type + return=minimal).
        // events_update_admin_or_captain (0006) gates this to the captain of
        // the event's chapter.
        return authFetch(SUPABASE_URL + '/rest/v1/events?id=eq.' + encodeURIComponent(event.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            recap_url: urlInput.value.trim() || null,
            recap_headline: headlineInput.value.trim() || null,
            recap_body: bodyInput.value.trim() || null,
            recap_photos_url: photos
          })
        }).then(function (r) {
          saveBtn.disabled = false;
          if (r && r.ok) {
            // Reflect saved values back into our in-memory event + UI so a
            // re-save keeps everything, then refresh like the other actions.
            existingPhotos = photos;
            event.recap_url = urlInput.value.trim() || null;
            event.recap_headline = headlineInput.value.trim() || null;
            event.recap_body = bodyInput.value.trim() || null;
            event.recap_photos_url = photos;
            photoInput.value = '';
            refreshPhotoCount();
            setStatus('Recap saved ✓', 'ok');
            if (typeof onChanged === 'function') onChanged();
          } else {
            setStatus('Couldn’t save recap — you may not have access to this event.', 'error');
          }
        });
      }).catch(function (err) {
        saveBtn.disabled = false;
        var msg = err && err.message;
        if (msg === 'too-large') {
          setStatus('Each photo must be under 5MB.', 'error');
        } else if (msg === 'bad-type') {
          setStatus('Unsupported image type. Use JPG, PNG, GIF, or WebP.', 'error');
        } else {
          // Bucket absent / 0008 not applied / network — keep composer usable.
          setStatus('Couldn’t upload photos. Try again.', 'error');
        }
      });
    });

    body.appendChild(form);
    return wrap;
  }

  // Load + group this chapter's events by status. events_select_authenticated
  // lets a logged-in user read all rows; we filter to this chapter client-side
  // via the chapter_id query param.
  function renderEventsSection(chapter, mount) {
    var section = el('div', 'cc-block');
    section.appendChild(el('div', 'cc-block-title', 'Events'));
    var listEl = el('div', 'cc-event-list');
    section.appendChild(listEl);
    mount.appendChild(section);

    // Base SELECT (always valid) + the recap columns (migration 0008). If 0008
    // isn't applied, PostgREST 400s on the unknown columns, so we transparently
    // retry with the base SELECT — the composer then renders with no prefill but
    // still works (GRACEFUL FALLBACK). recap_photos_url is a text[] of object
    // PATHS in the 'media' bucket (NOT public URLs).
    var BASE_SELECT = 'id,name,event_date,city,description,link,status,capacity';
    var RECAP_SELECT = BASE_SELECT + ',recap_url,recap_photos_url,recap_headline,recap_body';

    function fetchEvents(select) {
      return authFetch(SUPABASE_URL + '/rest/v1/events?select=' + select +
        '&chapter_id=eq.' + encodeURIComponent(chapter.id) + '&order=event_date.desc', {
        headers: {}
      });
    }

    function load() {
      listEl.textContent = '';
      listEl.appendChild(el('div', 'cc-roster-loading', 'Loading events…'));
      fetchEvents(RECAP_SELECT).then(function (r) {
        if (r && r.ok) return r.json();
        // 0008 not applied (400 on unknown recap columns) -> retry base SELECT.
        return fetchEvents(BASE_SELECT).then(function (r2) {
          if (!r2 || !r2.ok) return null;
          return r2.json();
        });
      }).then(function (rows) {
        listEl.textContent = '';
        if (!rows || !rows.length) {
          listEl.appendChild(el('div', 'cc-roster-empty',
            'No events for this chapter yet. Submit one to get started.'));
          return;
        }
        // Group by status: submitted (needs review) first, then approved,
        // draft, rejected.
        var order = ['submitted', 'approved', 'draft', 'rejected'];
        var groups = {};
        rows.forEach(function (ev) {
          var key = ev.status || 'other';
          (groups[key] = groups[key] || []).push(ev);
        });
        var seen = {};
        order.forEach(function (key) {
          if (!groups[key]) return;
          seen[key] = true;
          appendGroup(key, groups[key]);
        });
        // Any unexpected status values still render (defensive).
        Object.keys(groups).forEach(function (key) {
          if (!seen[key]) appendGroup(key, groups[key]);
        });
      }).catch(function () {
        listEl.textContent = '';
        listEl.appendChild(el('div', 'cc-roster-empty', 'Could not load events. Try again.'));
      });
    }

    function appendGroup(status, evs) {
      var group = el('div', 'cc-event-group');
      var heading = el('div', 'cc-group-heading');
      heading.appendChild(el('span', null, statusLabel(status)));
      heading.appendChild(el('span', 'cc-group-count', String(evs.length)));
      group.appendChild(heading);
      evs.forEach(function (ev) {
        group.appendChild(renderEventCard(ev, chapter, load));
      });
      listEl.appendChild(group);
    }

    load();
  }

  // ---------------------------------------------------------------------------
  // Render one captained chapter's full console panel.
  // ---------------------------------------------------------------------------
  function renderChapterConsole(chapter, role) {
    var panel = el('section', 'cc-chapter');

    var header = el('div', 'cc-chapter-header');
    var title = el('h2', 'cc-chapter-title');
    if (chapter.emoji) {
      title.appendChild(el('span', 'cc-chapter-emoji', chapter.emoji));
      title.appendChild(document.createTextNode(' '));
    }
    title.appendChild(document.createTextNode(chapter.name || 'Chapter'));
    header.appendChild(title);
    header.appendChild(el('span', 'cc-role-tag', role === 'admin' ? 'admin' : 'captain'));
    panel.appendChild(header);

    if (chapter.city) panel.appendChild(el('div', 'cc-chapter-city', chapter.city));

    // PRIVATE health dashboard first (momentum-forward), then the editor, the
    // event list, and the opt-in member directory. We append an EMPTY .cc-block
    // for health synchronously so it holds the top position (and the correct
    // :first-of-type border) regardless of when its read resolves; renderHealth
    // fills it, or REMOVES it on 404/error/no-row so a missing migration (0009)
    // leaves no empty section and can't break the panel — the editor + events
    // render regardless of whether stats/directory are available.
    var healthBlock = el('div', 'cc-block cc-health');
    panel.appendChild(healthBlock);
    renderHealth(chapter, healthBlock);
    panel.appendChild(renderChapterEditor(chapter));
    renderEventsSection(chapter, panel);
    renderDirectory(chapter, panel);

    return panel;
  }

  // ---------------------------------------------------------------------------
  // BOOT — cosmetic gate. Find the mount; read the caller's captain/admin
  // memberships; render a console per captained chapter. NOTHING renders if the
  // mount is absent, the memberships table is absent (404), the read errors, or
  // the user captains no chapter.
  // ---------------------------------------------------------------------------
  function boot() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return; // mount point absent -> no-op silently (graceful)

    if (!window.clawAuth || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    window.clawAuth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) return; // not signed in -> no console
      var uid = session.user && session.user.id;
      if (!uid) return;

      // Read the caller's captain/admin memberships joined to their chapters.
      // role=in.(captain,admin) restricts to manage-capable rows; an admin sees
      // their admin-membership chapters too. RLS confines this read to the
      // caller's own membership rows.
      return authFetch(SUPABASE_URL + '/rest/v1/memberships?select=chapter_id,role,' +
        'chapters(id,slug,name,city,blurb,emoji)&profile_id=eq.' + encodeURIComponent(uid) +
        '&role=in.(captain,admin)', { headers: {} }).then(function (r) {
        // Graceful fallback: table not applied yet (404), no access, or error.
        if (!r || r.status === 404 || !r.ok) return null;
        return r.json();
      }).then(function (rows) {
        if (!rows || !rows.length) return; // captains nothing -> render nothing

        // De-dupe by chapter id (a user shouldn't have two manage rows, but be
        // defensive) and skip rows whose embedded chapter didn't come back.
        var seen = {};
        var panels = [];
        rows.forEach(function (m) {
          var ch = m && m.chapters;
          if (!ch || ch.id == null) return;
          if (seen[ch.id]) return;
          seen[ch.id] = true;
          panels.push(renderChapterConsole(ch, m.role));
        });
        if (!panels.length) return; // nothing usable -> stay hidden

        root.textContent = '';
        root.className = 'cc-console';

        var intro = el('div', 'cc-intro');
        intro.appendChild(el('div', 'cc-intro-title', 'Captain’s Console'));
        intro.appendChild(el('div', 'cc-intro-sub',
          'See your chapter’s momentum, manage your chapter, review submitted ' +
          'events, check in RSVPs, and meet the members who opted into your directory.'));
        root.appendChild(intro);

        panels.forEach(function (p) { root.appendChild(p); });
      });
    }).catch(function () { /* graceful: render nothing */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ===========================================================================
  // RUNBOOK — DB dependencies for the v2.0 health + directory sections.
  // ===========================================================================
  // These read paths DEGRADE GRACEFULLY today (NO-OP / opt-in empty state) and
  // light up once the provisioning migration (0009, owned by the provisioning
  // slice — admin applies it server-side; anon cannot run DDL) adds the
  // following. ALL of these are PII-SAFE: counts and already-public profile
  // fields only, never an email or token, and the opt-in column DEFAULTS to
  // FALSE so nobody appears in a directory until they choose to.
  //
  // 1) profiles.is_public  boolean NOT NULL DEFAULT false
  //      The per-member directory opt-in. Members toggle it from their dashboard
  //      profile; the directory shows ONLY rows where is_public = true. Default
  //      false = nobody is listed until they opt in (no leak before opt-in).
  //
  // 2) public.chapter_directory  VIEW (anon/auth SELECT, owner-privileged like
  //    chapter_stats so it leaks no roster) exposing PII-FREE fields per opted-in
  //    member of a chapter, e.g.:
  //      SELECT cf.chapter_id, p.username, p.display_name, p.bio, p.photo_path
  //      FROM public.chapter_follows cf
  //      JOIN public.profiles p ON p.id = cf.profile_id
  //      WHERE p.is_public = true;     -- opt-in gate
  //    (memberships may be UNION'd in if chapter membership should also list.)
  //    The view exposes NO email/PII — only the public profile columns the
  //    profiles_select_public policy already makes readable (0005).
  //
  // 3) public.chapter_stats  VIEW — APPEND two columns (additive; CREATE OR
  //    REPLACE VIEW may add trailing columns, keeping id/slug/upcoming_events/
  //    total_events/events_hosted/total_attendees in order):
  //      followers          = count of chapter_follows for the chapter
  //      new_followers_30d  = count of chapter_follows with
  //                           created_at >= current_date - interval '30 days'
  //    These power the follower-growth + RSVP-conversion lines. The existing
  //    chapters page already reads stat.followers via numOr(...,0), so adding it
  //    also lights up that public count — still an aggregate, no roster exposed.
  //
  // Until 0009 ships: renderHealth() renders an em-dash for missing stats and
  // skips the derived lines; renderDirectory() shows 'No members have opted in
  // yet'. Neither ever leaks a non-opted-in member or a wrong number.
  // ===========================================================================
})();
