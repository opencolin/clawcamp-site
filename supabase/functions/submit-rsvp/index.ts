// ===========================================================================
// submit-rsvp — ClawCamp v1.3.0 RSVP write gateway (Supabase Edge Function / Deno)
// ===========================================================================
// WHAT THIS IS:
//   The SINGLE validating gateway for on-site RSVPs. The event detail page
//   (rsvp-detail-form slice) POSTs a JSON body here instead of doing a raw
//   /rest/v1/rsvps insert — because there is no such anon insert path.
//
// WHY IT EXISTS (council notes — "writes that must be trusted route through the
//   v1.2 validating Edge Function, NOT a raw leaky anon insert"):
//   Migration 0004 grants anon NO write (and NO read) on the `rsvps` table. So
//   the browser CANNOT write an RSVP directly. This function holds the
//   SERVICE-ROLE key (a server-side secret, never shipped to the browser — the
//   only key with write access to rsvps) and is therefore the ONLY writer. It
//   mirrors the security posture of the submit-event gateway: length caps,
//   email-format checks, reject-HTML, and a honeypot.
//
// THE PRODUCT MODEL — anonymous-email-first:
//   No login required. email (required) + optional name is enough to RSVP.
//   OPTIONAL account linkage: if a logged-in user's id is forwarded as
//   profile_id we attach it (best-effort, validated as a uuid); otherwise null.
//   Growth attribution (utm_source/medium/campaign + ref) is read from the
//   page's query string by the FRONTEND and passed in the body; we sanitize and
//   store it.
//
// STATUS IS CLAMPED, NEVER TRUSTED:
//   We accept only 'going' or 'waitlist' from the client and DEFAULT to 'going'.
//   The client can NEVER set 'cancelled' through this create path — cancellation
//   is out of scope for this slice (insert only). Any other value clamps to
//   'going'. This keeps the DB CHECK constraint a real control, not a hope.
//
// DUPLICATE HANDLING (documented for the frontend):
//   Migration 0004's partial unique index (uq_rsvps_event_email_active) rejects
//   a second ACTIVE RSVP for the same (event_id, lower(email)). When the insert
//   hits that unique violation (Postgres code 23505) we return a friendly
//   200 { ok: true, already: true } so the frontend can show a "You're already
//   going" state rather than an error. A bad event_id trips the FK
//   (Postgres code 23503) and we surface a 400 "Unknown event".
//
// ASSERTION TARGET: the anon write/read denials this function fronts are exactly
//   what scripts/rls-probe.sh (utm-probe-release slice) probes from a hostile
//   anon client — anon cannot read the rsvps roster and cannot raw-insert an
//   rsvp except through this function (which holds the service-role key).
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS -----------------------------------------------------------------
// The detail page is same-project but cross-origin to *.supabase.co, so the
// browser sends a preflight. We allow the apikey/content-type/authorization
// headers the supabase-js / fetch client attaches.
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

// --- Validation helpers ----------------------------------------------------

// Defense-in-depth: reject any value carrying HTML angle brackets or a
// javascript:/data: URL scheme. The render side is textContent-safe, but the
// gateway must ALSO reject HTML per the plan so stored-XSS can never land.
function hasHtmlOrBadScheme(val: unknown): boolean {
  if (typeof val !== "string") return false;
  if (/[<>]/.test(val)) return true;
  if (/(^|\s|["'(])(javascript|data)\s*:/i.test(val)) return true;
  return false;
}

// Trim + cap a string; returns null for empty. Records an error if over the cap
// or if it contains HTML / a bad scheme.
function cleanText(
  val: unknown,
  max: number,
  field: string,
  errors: string[],
): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== "string") {
    errors.push(`${field} must be a string`);
    return null;
  }
  const v = val.trim();
  if (!v) return null;
  if (v.length > max) {
    errors.push(`${field} exceeds ${max} characters`);
    return null;
  }
  if (hasHtmlOrBadScheme(v)) {
    errors.push(`${field} contains disallowed markup or URL scheme`);
    return null;
  }
  return v;
}

// Loose email format check (only when a value is present).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Loose UUID format check for the optional profile_id linkage.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Caps (kept conservative; mirror the submit-event "length caps" requirement).
const CAP_EMAIL = 254; // RFC 5321 practical max for an email address
const CAP_NAME = 200;
const CAP_FIELD = 200; // generic per-field cap (name + utm/ref attribution)

// Allowed RSVP statuses through this CREATE path. 'cancelled' is deliberately
// excluded — cancellation is out of scope for this slice (insert only).
const ALLOWED_STATUS = new Set(["going", "waitlist"]);

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

  // --- HONEYPOT -------------------------------------------------------------
  // If the hidden honeypot field is non-empty, a bot filled it. Return a fake
  // success and write NOTHING (silent drop) so the bot can't tell it failed.
  const honeypot = payload["website"];
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return json({ ok: true, id: null });
  }

  const errors: string[] = [];

  // --- Required: event_id ---------------------------------------------------
  // Must be a positive integer — it FKs to events.id (bigint). Accept a number
  // or a numeric string; reject anything missing / non-numeric / non-positive.
  const rawEventId = payload["event_id"];
  let eventId: number | null = null;
  if (typeof rawEventId === "number" && Number.isFinite(rawEventId)) {
    eventId = rawEventId;
  } else if (typeof rawEventId === "string" && rawEventId.trim() !== "") {
    const n = Number(rawEventId.trim());
    if (Number.isFinite(n)) eventId = n;
  }
  if (eventId === null || !Number.isInteger(eventId) || eventId <= 0) {
    errors.push("event_id is required and must be a positive integer");
  }

  // --- Required: email ------------------------------------------------------
  const email = cleanText(payload["email"], CAP_EMAIL, "email", errors);
  if (!email) {
    errors.push("email is required");
  } else if (!EMAIL_RE.test(email)) {
    errors.push("email is not a valid email address");
  }

  // --- Optional: name -------------------------------------------------------
  const name = cleanText(payload["name"], CAP_NAME, "name", errors);

  // --- Optional: UTM / ref attribution (captured from the page query string) -
  // The FRONTEND reads window.location.search and passes these in the body.
  const utmSource = cleanText(
    payload["utm_source"],
    CAP_FIELD,
    "utm_source",
    errors,
  );
  const utmMedium = cleanText(
    payload["utm_medium"],
    CAP_FIELD,
    "utm_medium",
    errors,
  );
  const utmCampaign = cleanText(
    payload["utm_campaign"],
    CAP_FIELD,
    "utm_campaign",
    errors,
  );
  const ref = cleanText(payload["ref"], CAP_FIELD, "ref", errors);

  // --- Status: clamp to the allowlist, default 'going' ----------------------
  // Never trust an arbitrary value; the client may not set 'cancelled' here.
  const rawStatus = payload["status"];
  const status =
    typeof rawStatus === "string" && ALLOWED_STATUS.has(rawStatus)
      ? rawStatus
      : "going";

  // --- Optional: profile_id linkage (best-effort) ---------------------------
  // Anonymous-first: accept it ONLY if it is a valid uuid string, else null.
  const rawProfileId = payload["profile_id"];
  const profileId =
    typeof rawProfileId === "string" && UUID_RE.test(rawProfileId.trim())
      ? rawProfileId.trim()
      : null;

  if (errors.length) {
    return json({ error: "Validation failed", details: errors }, 400);
  }

  // --- Service-role client --------------------------------------------------
  // SUPABASE_URL + the SERVICE_ROLE key are read from the Edge Function env
  // (server-side secrets, NEVER shipped to the browser). This is the only key
  // with write access to rsvps.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // --- Insert the RSVP (status clamped, event_id validated) -----------------
  const { data: inserted, error: insertErr } = await supabase
    .from("rsvps")
    .insert({
      event_id: eventId,
      email,
      name,
      status,
      profile_id: profileId,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      ref,
    })
    .select("id")
    .single();

  if (insertErr) {
    // 23505 = unique_violation: the partial unique index rejected a second
    // ACTIVE RSVP for this (event_id, lower(email)). Surface a friendly
    // "already going" state instead of an error.
    if (insertErr.code === "23505") {
      return json({ ok: true, already: true });
    }
    // 23503 = foreign_key_violation: event_id doesn't exist in events.
    if (insertErr.code === "23503") {
      return json({ error: "Unknown event" }, 400);
    }
    return json(
      { error: "Failed to create RSVP", details: insertErr.message },
      500,
    );
  }

  // Return the new id + the final (clamped) status so the page can confirm.
  return json({ ok: true, id: inserted?.id ?? null, status });
});
