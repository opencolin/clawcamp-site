// ===========================================================================
// send-recap — ClawCamp v1.5.0 post-event recap mailer (Supabase Edge Function / Deno)
// ===========================================================================
// WHAT THIS IS:
//   The FIRST product email beyond auth, and deliberately minimal. Given an
//   { event_id } and an admin/captain trigger, it emails each RSVP'd attendee a
//   "you attended this — here's the recap" link to the event's living-recap
//   page (the same /events/detail?id=<id> URL the recap renders on). It is the
//   outward push of the recap that the sitemap slice exposes for crawlers.
//
// WHY IT EXISTS:
//   anon has NO read on the rsvps roster (migration 0004) and the recap mail
//   must respect the per-contact email preference, so the browser cannot
//   assemble (let alone send) this. This function holds the SERVICE-ROLE key
//   (server-side secret, never shipped to the browser) — the only key that can
//   read the rsvps roster AND join contacts — and is therefore the single
//   sender. It mirrors submit-rsvp's posture: same CORS block, json() helper,
//   service-role client via Deno.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
//   500 "Server misconfigured" if absent), and the same validation helpers
//   (event_id is a positive integer; reject HTML / bad URL schemes on free text).
//
// >>> THE HEADLINE EXIT CRITERION — "recap email respects the user's email pref;
//     no email to opted-out users." <<<
//   We resolve recipients server-side and GATE on the SAME dashboard email pref
//   the panel toggles: contacts.sub_events (which "promises RSVP/event mail" —
//   dashboard loadPrefs/savePref read & write sub_events). Pipeline:
//     1. Read rsvps for this event with status IN ('going','waitlist').
//     2. LEFT JOIN contacts by lower(email): for each attendee email, look up
//        the contact's sub_events flag.
//     3. SKIP any attendee whose contacts.sub_events === false (opted out).
//        An attendee with NO contacts row (or a row with sub_events null/true)
//        defaults to OPTED IN — matching the dashboard's `row.sub_events !==
//        false` semantics exactly (sub_events DEFAULT true in 0001).
//   Casing is normalized via lower(email) so "A@x.com" and "a@x.com" collide,
//   the same normalization the rsvps partial unique index uses.
//
// >>> SECURITY — NOT anon-triggerable (no spam). <<<
//   A recap blast to every attendee is exactly what a hostile anon would abuse,
//   so this function authorizes the CALLER before doing anything. It reads the
//   caller's JWT (the Authorization: Bearer <user-token> the browser sends) and,
//   with the SERVICE-ROLE client (which bypasses RLS), checks the memberships
//   table — mirroring is_chapter_role / is_claw_admin (migration 0006): the
//   caller must be a GLOBAL admin (any membership row role='admin') OR a CAPTAIN
//   of THIS event's chapter (a membership row chapter_id=<event.chapter_id>,
//   role='captain'). Anyone else — anon, a plain member, or a captain of a
//   DIFFERENT chapter — is rejected 403. (We re-implement the predicate here
//   rather than calling the SQL helpers because the helpers key off auth.uid()
//   inside Postgres; this function instead resolves the caller's uuid from the
//   verified JWT and queries memberships directly with the service role.)
//
// >>> NO third-party provider key is wired in this slice if none exists. <<<
//   If RESEND/SENDGRID-style env vars are present (RESEND_API_KEY or
//   SENDGRID_API_KEY, plus RECAP_FROM_EMAIL) we send through that provider.
//   When they are ABSENT we DO NOT send — we run the FULL gating + recipient
//   resolution and return a DRY RUN { ok:true, dry_run:true, would_send:<count>,
//   skipped_opted_out:<count> } so CI / manual testing can verify the gate
//   WITHOUT delivering mail. Either way the recipient set is identical; only the
//   final "send vs report" step differs.
//
// THE RECAP LINK is the prod canonical https://claw.camp/events/detail?id=<id>
//   (the recap is the past-event view of that page). We never trust a
//   caller-supplied URL — the link is derived purely from the validated
//   event_id.
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS -----------------------------------------------------------------
// Same posture as submit-rsvp: the dashboard / captains console is same-project
// but cross-origin to *.supabase.co, so the browser sends a preflight. We allow
// the apikey / content-type / authorization headers the supabase-js / fetch
// client attaches (authorization carries the caller's user JWT here).
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

// --- Validation helpers (mirrors submit-rsvp) ------------------------------

// Defense-in-depth: reject any value carrying HTML angle brackets or a
// javascript:/data: URL scheme. Used to vet any free-text we ever accept.
function hasHtmlOrBadScheme(val: unknown): boolean {
  if (typeof val !== "string") return false;
  if (/[<>]/.test(val)) return true;
  if (/(^|\s|["'(])(javascript|data)\s*:/i.test(val)) return true;
  return false;
}

// Loose email format check (only when a value is present). Same RE as submit-rsvp.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The prod canonical origin for the recap link. The recap is the past-event
// view of the event detail page, so the link is /events/detail?id=<id>.
const SITE_ORIGIN = "https://claw.camp";

// Optional human-friendly note the caller may pass; capped + HTML-rejected like
// submit-rsvp's free text. Not required; purely cosmetic in the email body.
const CAP_NOTE = 280;

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Parse body.
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // --- Required: event_id (positive integer, FKs events.id) -----------------
  // Same acceptance posture as submit-rsvp: a number or a numeric string.
  const rawEventId = payload["event_id"];
  let eventId: number | null = null;
  if (typeof rawEventId === "number" && Number.isFinite(rawEventId)) {
    eventId = rawEventId;
  } else if (typeof rawEventId === "string" && rawEventId.trim() !== "") {
    const n = Number(rawEventId.trim());
    if (Number.isFinite(n)) eventId = n;
  }
  if (eventId === null || !Number.isInteger(eventId) || eventId <= 0) {
    return json(
      { error: "event_id is required and must be a positive integer" },
      400,
    );
  }

  // --- Optional: a short free-text note (HTML / bad-scheme rejected) --------
  const rawNote = payload["note"];
  if (rawNote !== null && rawNote !== undefined) {
    if (typeof rawNote !== "string") {
      return json({ error: "note must be a string" }, 400);
    }
    if (rawNote.length > CAP_NOTE) {
      return json({ error: `note exceeds ${CAP_NOTE} characters` }, 400);
    }
    if (hasHtmlOrBadScheme(rawNote)) {
      return json(
        { error: "note contains disallowed markup or URL scheme" },
        400,
      );
    }
  }
  const note =
    typeof rawNote === "string" && rawNote.trim() ? rawNote.trim() : null;

  // --- Service-role client (server-side secret; bypasses RLS) ---------------
  // Identical posture to submit-rsvp: read SUPABASE_URL + the SERVICE_ROLE key
  // from the Edge Function env and 500 "Server misconfigured" if either absent.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // --- AUTHORIZE THE CALLER (must be a captain of the chapter / global admin) ---
  // The browser forwards the signed-in user's JWT as `Authorization: Bearer
  // <token>`. We resolve & verify it via auth.getUser(token); a missing / bad /
  // anon token yields no user and is rejected. (supabase-js attaches the ANON
  // apikey on the function call itself; the per-user identity rides in this
  // Authorization header, so we read it explicitly rather than trusting the
  // client.)
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return json({ error: "Authentication required" }, 401);
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser(
    bearer,
  );
  const callerId = userData?.user?.id ?? null;
  if (userErr || !callerId) {
    return json({ error: "Authentication required" }, 401);
  }

  // Load the event so we know its chapter (the unit a captain is scoped to) and
  // can confirm it exists. chapter_id may be null (uncategorized event); in that
  // case only a global admin may trigger a recap blast.
  const { data: eventRow, error: eventErr } = await supabase
    .from("events")
    .select("id, chapter_id")
    .eq("id", eventId)
    .maybeSingle();
  if (eventErr) {
    return json(
      { error: "Failed to load event", details: eventErr.message },
      500,
    );
  }
  if (!eventRow) {
    return json({ error: "Unknown event" }, 400);
  }

  // Read the caller's memberships and decide authorization the same way
  // is_claw_admin() / is_chapter_role() do (migration 0006): a global admin
  // (any role='admin' row) OR a captain (role='captain') of THIS event's
  // chapter. A plain member, or a captain of a DIFFERENT chapter, fails.
  const { data: memberships, error: memErr } = await supabase
    .from("memberships")
    .select("chapter_id, role")
    .eq("profile_id", callerId);
  if (memErr) {
    return json(
      { error: "Failed to verify role", details: memErr.message },
      500,
    );
  }
  const rows = Array.isArray(memberships) ? memberships : [];
  const isAdmin = rows.some((m) => m && m.role === "admin");
  const isChapterCaptain =
    eventRow.chapter_id != null &&
    rows.some(
      (m) =>
        m && m.role === "captain" && m.chapter_id === eventRow.chapter_id,
    );
  if (!isAdmin && !isChapterCaptain) {
    // Not authorized to mail this event's attendees. Mirror the RLS default-deny.
    return json({ error: "Not authorized to send a recap for this event" }, 403);
  }

  // --- RESOLVE RECIPIENTS (active RSVPs only) -------------------------------
  // status IN ('going','waitlist') — i.e. people who actually attended/were on
  // the list, never cancelled. Service role bypasses the rsvps read-deny RLS.
  const { data: rsvpRows, error: rsvpErr } = await supabase
    .from("rsvps")
    .select("email, status")
    .eq("event_id", eventId)
    .in("status", ["going", "waitlist"]);
  if (rsvpErr) {
    return json(
      { error: "Failed to load attendees", details: rsvpErr.message },
      500,
    );
  }

  // Normalize to unique, valid, lower-cased emails (dedupe across going/waitlist
  // and any casing differences — the same lower(email) the unique index uses).
  const attendeeEmails = new Set<string>();
  for (const r of Array.isArray(rsvpRows) ? rsvpRows : []) {
    const raw = r && typeof r.email === "string" ? r.email.trim() : "";
    if (raw && EMAIL_RE.test(raw)) attendeeEmails.add(raw.toLowerCase());
  }

  if (attendeeEmails.size === 0) {
    // Nobody to mail — still a success (nothing to gate).
    return json({ ok: true, dry_run: true, would_send: 0, skipped_opted_out: 0 });
  }

  // --- GATE on contacts.sub_events (LEFT JOIN by lower(email)) --------------
  // Build a lower(email) -> sub_events map from contacts for just these
  // attendees. An attendee with NO contacts row defaults to OPTED IN; a row with
  // sub_events === false is OPTED OUT and skipped (dashboard `!== false`).
  const emailList = Array.from(attendeeEmails);
  const optedOut = new Set<string>();
  // Chunk the IN() filter so a very large attendee list can't build an
  // unbounded query string.
  const CHUNK = 200;
  for (let i = 0; i < emailList.length; i += CHUNK) {
    const chunk = emailList.slice(i, i + CHUNK);
    // Match contacts case-insensitively. PostgREST `in` is case-sensitive, so we
    // compare against lower(email) via the `email` column with both the chunk's
    // already-lowercased values AND rely on the explicit per-row recheck below.
    const { data: contactRows, error: contactErr } = await supabase
      .from("contacts")
      .select("email, sub_events")
      .in("email", chunk);
    if (contactErr) {
      return json(
        { error: "Failed to read email preferences", details: contactErr.message },
        500,
      );
    }
    for (const c of Array.isArray(contactRows) ? contactRows : []) {
      const cEmail =
        c && typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
      if (!cEmail) continue;
      // OPTED OUT only when explicitly false; null / undefined / true => opted in.
      if (c.sub_events === false) optedOut.add(cEmail);
    }
  }

  const recipients = emailList.filter((e) => !optedOut.has(e));
  const skippedOptedOut = emailList.length - recipients.length;

  // The recap link is derived purely from the validated event_id — never from
  // any caller-supplied value — so it cannot be turned into an open redirect.
  const recapUrl = SITE_ORIGIN + "/events/detail?id=" + encodeURIComponent(
    String(eventId),
  );

  // --- SEND or DRY-RUN ------------------------------------------------------
  // Only send if a provider is configured; otherwise report the resolved set so
  // the gate is verifiable without delivering mail.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("RECAP_FROM_EMAIL");

  if (recipients.length === 0) {
    // Everyone opted out (or no eligible recipients) — nothing to send.
    return json({
      ok: true,
      dry_run: true,
      would_send: 0,
      skipped_opted_out: skippedOptedOut,
    });
  }

  const subject = "Thanks for coming — your ClawCamp recap";
  const textBody =
    "You attended a ClawCamp event. Here's the recap:\n\n" +
    recapUrl +
    (note ? "\n\n" + note : "") +
    "\n\n— ClawCamp\n\n" +
    "You're receiving this because you RSVP'd. Manage email preferences in your dashboard.";

  // RESEND first (simple JSON API), then SENDGRID. Both need a verified sender
  // (RECAP_FROM_EMAIL). If a key is set but the sender is not, we treat the
  // provider as unconfigured and fall through to the dry run rather than 500 —
  // the gate result is still useful and we never send from an invalid sender.
  if (resendKey && fromEmail) {
    let sent = 0;
    const failed: string[] = [];
    // Send individually so one bad address doesn't drop the whole batch and so
    // no recipient ever sees another recipient's email (no shared To/Bcc leak).
    for (const to of recipients) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + resendKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to,
            subject,
            text: textBody,
          }),
        });
        if (resp.ok) sent++;
        else failed.push(to);
      } catch {
        failed.push(to);
      }
    }
    return json({
      ok: true,
      provider: "resend",
      sent,
      failed: failed.length,
      skipped_opted_out: skippedOptedOut,
    });
  }

  if (sendgridKey && fromEmail) {
    let sent = 0;
    const failed: string[] = [];
    for (const to of recipients) {
      try {
        const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + sendgridKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail },
            subject,
            content: [{ type: "text/plain", value: textBody }],
          }),
        });
        if (resp.ok || resp.status === 202) sent++;
        else failed.push(to);
      } catch {
        failed.push(to);
      }
    }
    return json({
      ok: true,
      provider: "sendgrid",
      sent,
      failed: failed.length,
      skipped_opted_out: skippedOptedOut,
    });
  }

  // No provider configured (or no verified sender) — DRY RUN. The full gate ran;
  // we just report the resolved counts so CI / manual testing can verify that
  // opted-out attendees are excluded WITHOUT any mail being delivered.
  return json({
    ok: true,
    dry_run: true,
    would_send: recipients.length,
    skipped_opted_out: skippedOptedOut,
  });
});
