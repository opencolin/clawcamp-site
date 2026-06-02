// ClawCamp Config — single source of truth for Supabase connection.
// The anon key is a public, RLS-gated JWT (safe to ship to the browser).
// Load this BEFORE any other /js/* script or inline Supabase usage.
(function () {
  window.CLAWCAMP_CONFIG = {
    SUPABASE_URL: 'https://mrnccntqmkxjazznejfc.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmNjbnRxbWt4amF6em5lamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA3NTksImV4cCI6MjA5MDc3Njc1OX0.T6oFTtYiFTsx6ojuogpZFXAS7tN5-dPzwvmY5V2xFGI',

    // ------------------------------------------------------------------
    // Production error-reporting sink (v2.0.0).
    // Wire this to a real backend by setting ONE of:
    //   - SENTRY_DSN  : a @sentry/browser DSN (https://<key>@<org>.ingest.sentry.io/<project>)
    //   - ERROR_SINK_URL : a Supabase Edge Function / log endpoint that accepts
    //                       a POST of the JSON payload below.
    // Leave both '' (the default) to fall back to console.error only — never a
    // network call, never a thrown error. Nothing breaks if these stay empty.
    SENTRY_DSN: '',
    ERROR_SINK_URL: ''
  };

  // ====================================================================
  // Production error-reporting hook (v2.0.0) — global, zero-HTML-edit.
  // ====================================================================
  // This file is loaded FIRST on every key page (/, /events, /chapters,
  // /events/detail, /dashboard, /admin), so installing the handler here covers
  // the whole site with NO per-page edits. It is intentionally
  // dependency-free (no SDK, no inline-blocked eval) so it cannot trip the
  // Content-Security-Policy the quality-wall slice adds — but note: whatever
  // endpoint you wire below (SENTRY_DSN or ERROR_SINK_URL) MUST be added to the
  // CSP `connect-src` allowlist in vercel.json, or the report POST is blocked.
  //
  // Sentry-ready: the simplest production wiring is to point reportError at
  // @sentry/browser's Sentry.captureException, or at a Supabase logging
  // function. To do that, override window.CLAWCAMP_CONFIG.reportError after this
  // script loads (or fill SENTRY_DSN / ERROR_SINK_URL above).
  //
  // PII posture: the payload carries ONLY error metadata + the pathname + the
  // user-agent. It deliberately does NOT read cookies, localStorage, the JWT,
  // email addresses, form values, or query strings — so an error report can
  // never exfiltrate a person's data. Keep it that way.

  var cfg = window.CLAWCAMP_CONFIG;

  // Pluggable, safe-by-default sink. Override this to integrate Sentry, e.g.:
  //   window.CLAWCAMP_CONFIG.reportError = function (p) { Sentry.captureException(p); };
  cfg.reportError = function (payload) {
    try {
      // 1) A real Sentry DSN → use the Store endpoint with a dependency-free
      //    POST (no SDK needed). Best-effort; failures are swallowed.
      if (cfg.SENTRY_DSN) {
        // Parse the DSN: https://<publicKey>@<host>/<projectId>
        var m = /^https?:\/\/([^@]+)@([^/]+)\/(.+)$/.exec(cfg.SENTRY_DSN);
        if (m) {
          var publicKey = m[1], host = m[2], projectId = m[3];
          var endpoint = 'https://' + host + '/api/' + projectId + '/store/' +
            '?sentry_version=7&sentry_client=clawcamp-config/2.0' +
            '&sentry_key=' + encodeURIComponent(publicKey);
          var event = {
            platform: 'javascript',
            level: 'error',
            message: payload.message,
            request: { url: location.origin + payload.url, headers: { 'User-Agent': payload.userAgent } },
            extra: { source: payload.source, lineno: payload.lineno, colno: payload.colno, stack: payload.stack }
          };
          fetch(endpoint, {
            method: 'POST',
            mode: 'cors',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
          }).catch(function () { /* best-effort; never surface */ });
          return;
        }
      }

      // 2) A generic sink URL (e.g. a Supabase Edge Function) → POST the raw payload.
      if (cfg.ERROR_SINK_URL) {
        fetch(cfg.ERROR_SINK_URL, {
          method: 'POST',
          mode: 'cors',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(function () { /* best-effort; never surface */ });
        return;
      }
    } catch (e) {
      // Never let the reporter itself break the page.
    }

    // 3) No backend configured → console only (dev / pre-wiring default).
    if (window.console && console.error) {
      console.error('[ClawCamp] client error', payload);
    }
  };

  // Build a PII-free payload from an Error/event and hand it to the sink.
  function buildAndReport(message, source, lineno, colno, error) {
    var stack = '';
    if (error && error.stack) {
      stack = String(error.stack).slice(0, 2000); // truncate — keep reports small
    }
    var payload = {
      message: String(message || 'Unknown error').slice(0, 500),
      source: source ? String(source).slice(0, 500) : '',
      lineno: typeof lineno === 'number' ? lineno : null,
      colno: typeof colno === 'number' ? colno : null,
      stack: stack,
      url: location.pathname,        // pathname only — no query string (no PII)
      userAgent: navigator.userAgent
    };
    try {
      cfg.reportError(payload);
    } catch (e) {
      // The hook must NEVER throw or block the page.
    }
  }

  // Uncaught runtime errors.
  window.addEventListener('error', function (e) {
    // Ignore resource-load errors (img/script 404s have no e.message/e.error).
    if (!e || (!e.message && !e.error)) return;
    buildAndReport(e.message, e.filename, e.lineno, e.colno, e.error);
  });

  // Unhandled promise rejections.
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e ? e.reason : null;
    var message = (reason && reason.message) ? reason.message : String(reason);
    buildAndReport('Unhandled promise rejection: ' + message, '', null, null, reason);
  });

  // Exit-criterion hook: `?__test_error=1` forces ONE synthetic client error so
  // an operator can confirm "Sentry captures a test client error" end to end.
  // It throws asynchronously (so it is caught by the window 'error' handler
  // above) and never blocks page load.
  try {
    if (location.search && location.search.indexOf('__test_error=1') !== -1) {
      setTimeout(function () {
        throw new Error('ClawCamp synthetic test error (?__test_error=1)');
      }, 0);
    }
  } catch (e) {
    // ignore — never block boot
  }
})();
