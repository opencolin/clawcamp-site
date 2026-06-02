// ===========================================================================
// notify-engagement — ClawCamp v2.0.0 engagement-notification mailer
// (Supabase Edge Function / Deno)
// ===========================================================================
// WHAT THIS IS:
//   The out-of-band engagement mailer that turns the relational spine
//   (chapter_follows + rsvps + the dashboard email prefs on contacts) into two
//   kinds of email, BOTH gated on the same deliverability-protecting preference
//   the dashboard toggles (contacts.sub_events):
//     (i)  NEW-EVENT DIGEST  — when a chapter you FOLLOW gets a newly-approved
//          event, the people following that chapter hear about it.
//     (ii) RSVP REMINDER     — people who RSVP'd 'going' to an event happening
//          within the next N days get a nudge so they actually show up.
//   It is the engagement counterpart to send-recap (the post-event mailer) and
//   shares send-recap's exact security skeleton: same CORS block, same json()
//   helper, the SERVICE-ROLE client via Deno.env (SUPABASE_URL +
//   SUPABASE_SERVICE_ROLE_KEY; 500 "Server misconfigured" if absent), the same
//   validation helpers (positive-integer ids; reject HTML / bad URL schemes on
//   any free text), per-recipient sends (no shared To/Bcc leak), and the same
//   provider-or-dry-run affordance (RESEND_API_KEY / SENDGRID_API_KEY +
//   RECAP_FROM_EMAIL; dry-run report when no provider is configured).
//
// >>> TRIGGERED OUT-OF-BAND (cron / manual invoke), NEVER from the browser. <<<
//   Unlike submit-rsvp / submit-follow (anon-fronting public-write gateways)
//   and send-recap (a captain/admin clicks "send recap"), this function is a
//   SCHEDULED / OPERATOR job. It is invoked by a trusted out-of-band caller that
//   presents the SERVICE-ROLE key as the Bearer token (e.g. a Supabase
//   scheduled function / pg_cron net.http_post / an admin `supabase functions
//   invoke` / a CI step). It is NOT meant to be called by an end-user session
//   and is NOT wired to any anon-key browser path. See the RUNBOOK block below.
//
//   AUTHORIZATION: the caller MUST present the service-role key as
//   `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. We compare it (constant
//   work, length-checked) against the env service-role key; anything else —
//   anon key, a user JWT, a captain token, a missing header — is rejected 401.
//   A blast to every follower / every attendee is exactly what a hostile client
//   would abuse, so there is intentionally NO captain/membership path in here:
//   only the holder of the server-side secret may fire engagement mail.
//
// >>> THE HEADLINE EXIT CRITERION — "respects sub_events; never emails someone
//     who opted out." <<<
//   EVERY recipient set is GATED on the SAME dashboard email pref the prefs
//   center toggles: contacts.sub_events (the toggle whose copy already PROMISES
//   "followed-chapter new events" + "RSVP reminders"). Pipeline, identical
//   semantics to send-recap:
//     1. Resolve candidate emails server-side (followers for the new-event
//        digest; 'going' RSVPs for the reminder) — service-role reads, because
//        chapter_follows / rsvps / contacts are all anon-locked (0004/0007/0001).
//     2. LEFT-JOIN contacts by lower(email) and SKIP any address whose
//        contacts.sub_events === false. An address with NO contacts row (or a
//        row with sub_events null/true) defaults to OPTED IN — matching the
//        dashboard's `row.sub_events !== false` semantics and send-recap exactly
//        (sub_events DEFAULT true in 0001).
//   Casing is normalized via toLowerCase() so "A@x.com" and "a@x.com" collide,
//   the same normalization the rsvps / chapter_follows unique indexes use.
//
// >>> EVERY EMAIL CARRIES AN UNSUBSCRIBE / PREFERENCES LINK to /dashboard. <<<
//   The dashboard "Notification preferences" section is the opt-out surface this
//   function links to in the body of EVERY message (PREFS_URL below), so a
//   recipient can always turn the category off — that link + the sub_events gate
//   together are how we protect deliverability (a clear unsubscribe path keeps
//   us out of spam folders and honors the council's deliverability rule). The
//   link is a fixed derived URL, never caller-supplied (no open redirect).
//
// >>> NO third-party provider key is wired if none exists (same as send-recap).
//   If RESEND_API_KEY or SENDGRID_API_KEY (+ RECAP_FROM_EMAIL) are present we
//   send through that provider, one message per recipient. When ABSENT we run
//   the FULL gating + recipient resolution and return a DRY RUN report
//   { ok:true, dry_run:true, would_send, skipped_opted_out, ... } so CI / manual
//   testing can verify the gate WITHOUT delivering mail. Either way the
//   recipient set is identical; only the final "send vs report" step differs.
//
// ---------------------------------------------------------------------------
// RUNBOOK — operator / scheduling notes (this function is out-of-band):
// ---------------------------------------------------------------------------
//   * SCHEDULING: invoke on a cadence (e.g. nightly) from a trusted context with
//     the service-role key as the Bearer token, e.g.
//       supabase functions invoke notify-engagement \
//         --no-verify-jwt \
//         -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
//         --body '{"mode":"both","reminder_within_days":3}'
//     or via pg_cron + net.http_post posting the same JSON body. Run it from CI
//     with NO provider key set first to verify the dry-run counts before wiring
//     a real RESEND_API_KEY/SENDGRID_API_KEY + RECAP_FROM_EMAIL.
//   * BODY (all optional):
//       mode                  'new_events' | 'reminders' | 'both'  (default 'both')
//       reminder_within_days  1..30 lookahead for RSVP reminders   (default 3)
//       event_ids             number[] — restrict the NEW-EVENT digest to these
//                             just-approved event ids (the recommended trigger:
//                             pass the id(s) that just flipped to 'approved').
//                             Omit to digest events approved in the last 24h.
//   * DEDUPE / SUPPRESSION (FOLLOW-UP — needs DDL the provisioning migration
//     0009 should add; this function degrades gracefully until then):
//       To avoid re-sending the same digest/reminder on every run, the
//       recommended schema is a `notification_log(kind, event_id, email,
//       sent_at)` table written by THIS function and consulted before sending.
//       It is NOT yet created (0009 is owned by the provisioning slice), so this
//       function does NOT dedupe across runs today — operators should therefore
//       pass an explicit `event_ids` for the new-event digest (send once when an
//       event is approved) and keep `reminder_within_days` small so a reminder
//       fires at most a couple of times near the event. Adding notification_log
//       in 0009 + an INSERT-then-skip here is the planned hardening.
//   * NEVER emails an opted-out address (sub_events === false). NEVER reads or
//     emits any field beyond the address being mailed; no roster/email list is
//     ever returned to a caller (only counts).
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS -----------------------------------------------------------------
// Same posture as send-recap / submit-rsvp. This function is normally invoked
// server-to-server (no browser), but we keep the identical CORS block so a
// manual `supabase functions invoke` / fetch from a tool still works and the
// preflight is answered.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Validation helpers (mirrors send-recap / submit-follow) ---------------

// Defense-in-depth: reject any value carrying HTML angle brackets or a
// javascript:/data: URL scheme. Used to vet any free text we ever interpolate
// into an email body (the render side is plain text, but we reject HTML anyway).
function hasHtmlOrBadScheme(val: unknown): boolean {
  if (typeof val !== "string") return false;
  if (/[<>]/.test(val)) return true;
  if (/(^|\s|["'(])(javascript|data)\s*:/i.test(val)) return true;
  return false;
}

// Loose email format check (only when a value is present). Same RE as send-recap.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The prod canonical origin. Event links are the public detail page; the
// preferences/unsubscribe link is the dashboard prefs center this slice owns.
const SITE_ORIGIN = "https://claw.camp";
const PREFS_URL = SITE_ORIGIN + "/dashboard";

// Caps + bounds.
const CAP_NOTE = 280;
const DEFAULT_REMINDER_DAYS = 3;
const MAX_REMINDER_DAYS = 30;
const CHUNK = 200; // chunk IN() filters so a large list can't build an unbounded query

// Coerce a value to a positive integer (number or numeric string), else null.
function toPosInt(raw: unknown): number | null {
  let n: number | null = null;
  if (typeof raw === "number" && Number.isFinite(raw)) n = raw;
  else if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) n = parsed;
  }
  if (n === null || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

// Build a YYYY-MM-DD date string `days` from today (UTC date arithmetic; the
// events table stores event_date as a plain date, compared as a string exactly
// like the captains console / detail page do).
function dateStrPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
// An ISO timestamp `hours` in the past (for the "approved in the last 24h"
// default window of the new-event digest).
function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// sub_events GATE (shared by both email types). Given a set of candidate
// lower-cased emails, return the subset that has NOT opted out — i.e. drop any
// address whose contacts.sub_events === false. An address with no contacts row,
// or a row with sub_events null/true, stays IN (dashboard `!== false`). Service
// role bypasses the contacts SELECT lockdown (0001). Resolves to
// { recipients, skippedOptedOut } or throws on a read error.
// ---------------------------------------------------------------------------
async function gateOnSubEvents(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  emails: Set<string>,
): Promise<{ recipients: string[]; skippedOptedOut: number }> {
  const emailList = Array.from(emails);
  if (emailList.length === 0) return { recipients: [], skippedOptedOut: 0 };

  const optedOut = new Set<string>();
  for (let i = 0; i < emailList.length; i += CHUNK) {
    const chunk = emailList.slice(i, i + CHUNK);
    const { data: contactRows, error: contactErr } = await supabase
      .from("contacts")
      .select("email, sub_events")
      .in("email", chunk);
    if (contactErr) {
      throw new Error("Failed to read email preferences: " + contactErr.message);
    }
    for (const c of (Array.isArray(contactRows) ? contactRows : []) as Array<
      { email?: unknown; sub_events?: unknown }
    >) {
      const cEmail =
        c && typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
      if (!cEmail) continue;
      // OPTED OUT only when explicitly false; null / undefined / true => opted in.
      if (c.sub_events === false) {
        optedOut.add(cEmail);
      }
    }
  }
  const recipients = emailList.filter((e) => !optedOut.has(e));
  return { recipients, skippedOptedOut: emailList.length - recipients.length };
}

// ---------------------------------------------------------------------------
// Per-recipient send. One message per address so one bad address never drops
// the whole batch and no recipient ever sees another's email (no shared To/Bcc
// leak) — identical posture to send-recap. Returns { sent, failed }. When no
// provider is configured the caller dry-runs instead of calling this.
// ---------------------------------------------------------------------------
async function sendAll(
  recipients: string[],
  subject: string,
  textBody: string,
  provider: "resend" | "sendgrid",
  apiKey: string,
  fromEmail: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      let resp: Response;
      if (provider === "resend") {
        resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: fromEmail, to, subject, text: textBody }),
        });
      } else {
        resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail },
            subject,
            content: [{ type: "text/plain", value: textBody }],
          }),
        });
      }
      if (resp.ok || resp.status === 202) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // --- Service-role client (server-side secret; bypasses RLS) ---------------
  // Identical posture to send-recap: read SUPABASE_URL + the SERVICE_ROLE key
  // from the Edge Function env and 500 "Server misconfigured" if either absent.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  // --- AUTHORIZE THE CALLER (out-of-band: must hold the service-role key) ----
  // This is a scheduled/operator job, NOT an end-user path. The caller must
  // present the service-role key as the Bearer token. We reject anything else
  // (anon key, a user JWT, a captain token, a missing header) — a blast to every
  // follower/attendee is exactly what a hostile client would abuse, so only the
  // holder of the server-side secret may fire engagement mail.
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer || bearer.length !== serviceRoleKey.length || bearer !== serviceRoleKey) {
    return json({ error: "Authentication required" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Parse body (all fields optional; default to a safe "both" run).
  let payload: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text && text.trim()) payload = JSON.parse(text);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // --- mode -----------------------------------------------------------------
  const rawMode = payload["mode"];
  const mode =
    rawMode === "new_events" || rawMode === "reminders" || rawMode === "both"
      ? rawMode
      : "both";

  // --- reminder_within_days (1..30) -----------------------------------------
  let reminderDays = DEFAULT_REMINDER_DAYS;
  if (payload["reminder_within_days"] !== undefined) {
    const n = toPosInt(payload["reminder_within_days"]);
    if (n === null || n > MAX_REMINDER_DAYS) {
      return json(
        { error: `reminder_within_days must be an integer between 1 and ${MAX_REMINDER_DAYS}` },
        400,
      );
    }
    reminderDays = n;
  }

  // --- event_ids (optional positive-integer list for the new-event digest) --
  let eventIds: number[] | null = null;
  if (payload["event_ids"] !== undefined && payload["event_ids"] !== null) {
    if (!Array.isArray(payload["event_ids"])) {
      return json({ error: "event_ids must be an array of positive integers" }, 400);
    }
    const ids: number[] = [];
    for (const raw of payload["event_ids"] as unknown[]) {
      const n = toPosInt(raw);
      if (n === null) {
        return json({ error: "event_ids must be an array of positive integers" }, 400);
      }
      ids.push(n);
    }
    eventIds = ids;
  }

  // --- Optional: a short free-text note (HTML / bad-scheme rejected) --------
  // Purely cosmetic; appended to the email body if present.
  const rawNote = payload["note"];
  if (rawNote !== null && rawNote !== undefined) {
    if (typeof rawNote !== "string") {
      return json({ error: "note must be a string" }, 400);
    }
    if (rawNote.length > CAP_NOTE) {
      return json({ error: `note exceeds ${CAP_NOTE} characters` }, 400);
    }
    if (hasHtmlOrBadScheme(rawNote)) {
      return json({ error: "note contains disallowed markup or URL scheme" }, 400);
    }
  }
  const note =
    typeof rawNote === "string" && rawNote.trim() ? rawNote.trim() : null;

  // Provider config (shared by both email types).
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("RECAP_FROM_EMAIL");
  const provider: { kind: "resend" | "sendgrid"; key: string } | null =
    resendKey && fromEmail
      ? { kind: "resend", key: resendKey }
      : sendgridKey && fromEmail
      ? { kind: "sendgrid", key: sendgridKey }
      : null;

  // The unsubscribe / preferences footer appended to EVERY email body. Derived,
  // never caller-supplied.
  const prefsFooter =
    "\n\n— ClawCamp\n\n" +
    "Manage which emails you get (or turn these off) in your notification " +
    "preferences: " + PREFS_URL;

  const result: Record<string, unknown> = { ok: true, mode };
  let anySend = false;

  // =========================================================================
  // (i) NEW-EVENT DIGEST — newly-approved events -> followers of their chapter
  // =========================================================================
  if (mode === "new_events" || mode === "both") {
    // Find the just-approved events to digest. Default window: approved in the
    // last 24h (created_at is the closest proxy we have for "just approved";
    // there is no approved_at column). An explicit event_ids list overrides the
    // window (the recommended trigger: pass the id(s) that just flipped).
    let evQuery = supabase
      .from("events")
      .select("id, name, event_date, city, chapter_id")
      .eq("status", "approved")
      .not("chapter_id", "is", null);
    if (eventIds && eventIds.length) {
      evQuery = evQuery.in("id", eventIds);
    } else {
      evQuery = evQuery.gte("created_at", isoHoursAgo(24));
    }
    const { data: events, error: evErr } = await evQuery;
    if (evErr) {
      return json({ error: "Failed to load events", details: evErr.message }, 500);
    }

    let totalRecipients = 0;
    let totalSkipped = 0;
    let totalSent = 0;
    let totalFailed = 0;
    const perEvent: Array<Record<string, unknown>> = [];

    for (const ev of Array.isArray(events) ? events : []) {
      const chapterId = (ev as { chapter_id?: number }).chapter_id;
      if (chapterId == null) continue;

      // Followers of this event's chapter. chapter_follows is anon-locked
      // (0007); the service role reads it. We only ever pull the email column.
      const { data: follows, error: fErr } = await supabase
        .from("chapter_follows")
        .select("email")
        .eq("chapter_id", chapterId);
      if (fErr) {
        return json({ error: "Failed to load followers", details: fErr.message }, 500);
      }
      const emails = new Set<string>();
      for (const f of Array.isArray(follows) ? follows : []) {
        const raw =
          f && typeof (f as { email?: unknown }).email === "string"
            ? ((f as { email: string }).email).trim()
            : "";
        if (raw && EMAIL_RE.test(raw)) emails.add(raw.toLowerCase());
      }

      // GATE on sub_events.
      let gated;
      try {
        gated = await gateOnSubEvents(supabase, emails);
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
      totalRecipients += gated.recipients.length;
      totalSkipped += gated.skippedOptedOut;

      const eventUrl =
        SITE_ORIGIN + "/events/detail?id=" + encodeURIComponent(String((ev as { id: number }).id));
      const evName = (ev as { name?: string }).name || "A new event";
      const evCity = (ev as { city?: string }).city || "";

      const sentForThis = { event_id: (ev as { id: number }).id } as Record<string, unknown>;

      if (provider && gated.recipients.length) {
        const subject = "New ClawCamp event from a chapter you follow";
        const textBody =
          "A chapter you follow just announced a new event:\n\n" +
          evName +
          (evCity ? "\n" + evCity : "") +
          "\n\n" + eventUrl +
          (note ? "\n\n" + note : "") +
          "\n\n" +
          "You're getting this because you follow this chapter on ClawCamp." +
          prefsFooter;
        const { sent, failed } = await sendAll(
          gated.recipients,
          subject,
          textBody,
          provider.kind,
          provider.key,
          fromEmail as string,
        );
        anySend = true;
        totalSent += sent;
        totalFailed += failed;
        sentForThis.sent = sent;
        sentForThis.failed = failed;
      } else {
        sentForThis.would_send = gated.recipients.length;
      }
      sentForThis.skipped_opted_out = gated.skippedOptedOut;
      perEvent.push(sentForThis);
    }

    result.new_events = {
      events_considered: Array.isArray(events) ? events.length : 0,
      recipients: totalRecipients,
      skipped_opted_out: totalSkipped,
      ...(provider ? { sent: totalSent, failed: totalFailed } : { would_send: totalRecipients, dry_run: true }),
      per_event: perEvent,
    };
  }

  // =========================================================================
  // (ii) RSVP REMINDER — 'going' RSVPs for events within the next N days
  // =========================================================================
  if (mode === "reminders" || mode === "both") {
    const from = todayStr();
    const to = dateStrPlusDays(reminderDays);

    // Upcoming approved events in the window. (We only remind for approved
    // events — a rejected/cancelled event should never trigger a reminder.)
    const { data: upcoming, error: upErr } = await supabase
      .from("events")
      .select("id, name, event_date, city")
      .eq("status", "approved")
      .gte("event_date", from)
      .lte("event_date", to);
    if (upErr) {
      return json({ error: "Failed to load upcoming events", details: upErr.message }, 500);
    }

    let totalRecipients = 0;
    let totalSkipped = 0;
    let totalSent = 0;
    let totalFailed = 0;
    const perEvent: Array<Record<string, unknown>> = [];

    for (const ev of Array.isArray(upcoming) ? upcoming : []) {
      const evId = (ev as { id: number }).id;
      // 'going' RSVPs only (a reminder is for people who said they're coming;
      // waitlist/cancelled get no nudge). rsvps is anon-locked (0004); service
      // role reads it. We only pull the email column.
      const { data: rsvps, error: rErr } = await supabase
        .from("rsvps")
        .select("email")
        .eq("event_id", evId)
        .eq("status", "going");
      if (rErr) {
        return json({ error: "Failed to load RSVPs", details: rErr.message }, 500);
      }
      const emails = new Set<string>();
      for (const r of Array.isArray(rsvps) ? rsvps : []) {
        const raw =
          r && typeof (r as { email?: unknown }).email === "string"
            ? ((r as { email: string }).email).trim()
            : "";
        if (raw && EMAIL_RE.test(raw)) emails.add(raw.toLowerCase());
      }

      // GATE on sub_events (RSVP reminders are gated the same as new-event mail;
      // the dashboard pref copy promises both under this one toggle).
      let gated;
      try {
        gated = await gateOnSubEvents(supabase, emails);
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
      totalRecipients += gated.recipients.length;
      totalSkipped += gated.skippedOptedOut;

      const eventUrl =
        SITE_ORIGIN + "/events/detail?id=" + encodeURIComponent(String(evId));
      const evName = (ev as { name?: string }).name || "your ClawCamp event";
      const evDate = (ev as { event_date?: string }).event_date || "";
      const evCity = (ev as { city?: string }).city || "";

      const sentForThis = { event_id: evId } as Record<string, unknown>;

      if (provider && gated.recipients.length) {
        const subject = "Reminder: " + evName + " is coming up";
        const textBody =
          "You RSVP'd 'going' to " + evName +
          (evDate ? " on " + evDate : "") +
          (evCity ? " (" + evCity + ")" : "") + ".\n\n" +
          "Details: " + eventUrl +
          (note ? "\n\n" + note : "") +
          "\n\n" +
          "You're getting this because you RSVP'd on ClawCamp." +
          prefsFooter;
        const { sent, failed } = await sendAll(
          gated.recipients,
          subject,
          textBody,
          provider.kind,
          provider.key,
          fromEmail as string,
        );
        anySend = true;
        totalSent += sent;
        totalFailed += failed;
        sentForThis.sent = sent;
        sentForThis.failed = failed;
      } else {
        sentForThis.would_send = gated.recipients.length;
      }
      sentForThis.skipped_opted_out = gated.skippedOptedOut;
      perEvent.push(sentForThis);
    }

    result.reminders = {
      window_days: reminderDays,
      events_considered: Array.isArray(upcoming) ? upcoming.length : 0,
      recipients: totalRecipients,
      skipped_opted_out: totalSkipped,
      ...(provider ? { sent: totalSent, failed: totalFailed } : { would_send: totalRecipients, dry_run: true }),
      per_event: perEvent,
    };
  }

  // Top-level dry_run flag mirrors send-recap: true when no provider was
  // configured (or nothing was actually sent), so CI can assert the gate ran
  // without delivering mail.
  result.dry_run = !provider || !anySend;
  return json(result);
});
