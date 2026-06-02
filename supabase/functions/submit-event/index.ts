// ===========================================================================
// submit-event — ClawCamp v1.2.0 write gateway (Supabase Edge Function / Deno)
// ===========================================================================
// WHAT THIS IS:
//   The SINGLE validating gateway for all public event submissions and their
//   child rows (speakers / schedule / sponsors). The submit-event page (slice
//   B) POSTs a JSON body here instead of doing a raw /rest/v1/events insert.
//
// WHY IT EXISTS (council notes — "introduce the write gateway exactly when the
//   first new public-write tables appear"):
//   Migration 0003 REVOKEs the old blanket anon INSERT on `events` and grants
//   anon NO write at all on the new event_speakers / event_schedule /
//   event_sponsors tables. So the browser can no longer write any of this. This
//   function holds the SERVICE-ROLE key (server-side secret, never shipped to
//   the browser — the only key with write access to events + the child tables)
//   and is therefore the ONLY writer. It mirrors the security posture of the
//   contacts path in js/supabase.js: length caps, email/URL format checks,
//   reject-HTML, server-side normalizeUrl, and a honeypot.
//
// THE MODERATION GATE:
//   The parent event is ALWAYS inserted with status='submitted'. The client can
//   NEVER set status='approved' — approval is an /admin action (the admin
//   allowlist is the interim stopgap, superseded by v1.4 RBAC). This is why the
//   anon read policy in 0003 (status='approved' only) is a real control and not
//   a cosmetic hide.
//
// ASSERTION TARGET: the child-table write denials this function fronts are
//   exactly what scripts/rls-probe.sh (d) probes from a hostile anon client —
//   anon cannot insert a child row pointing at an arbitrary event_id except
//   through this function.
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS -----------------------------------------------------------------
// The submit-event page is same-project but cross-origin to *.supabase.co, so
// the browser sends a preflight. We allow the apikey/content-type/authorization
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

// Server-side port of normalizeUrl from js/supabase.js: prepend https:// when
// no scheme is present. Applied to link / photo_url / sponsor_url before insert.
function normalizeUrl(val: unknown): string | null {
  if (typeof val !== "string") return null;
  let v = val.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
}

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

// Validate + normalize a URL field. Empty -> null. On bad scheme/HTML or
// over-length, records an error.
function cleanUrl(
  val: unknown,
  max: number,
  field: string,
  errors: string[],
): string | null {
  const cleaned = cleanText(val, max, field, errors);
  if (!cleaned) return null;
  const normalized = normalizeUrl(cleaned);
  if (!normalized) return null;
  // Re-check the normalized value (https:// prefix can't introduce HTML, but
  // keep the scheme guard explicit).
  if (hasHtmlOrBadScheme(normalized) || !/^https?:\/\//i.test(normalized)) {
    errors.push(`${field} must be a valid http(s) URL`);
    return null;
  }
  return normalized;
}

// Loose email format check (only when a value is present).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Caps (kept conservative; mirror the council "length caps" requirement).
const CAP_NAME = 200;
const CAP_DESC = 5000;
const CAP_FIELD = 500; // generic per-field cap (parent + child text fields)
const CAP_NOTES = 5000; // reviewer notes free-text
const CAP_ARRAY = 50; // max speakers / schedule blocks / sponsors

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

  const ev = (payload["event"] ?? {}) as Record<string, unknown>;
  const speakersIn = Array.isArray(payload["speakers"])
    ? (payload["speakers"] as Record<string, unknown>[])
    : [];
  const scheduleIn = Array.isArray(payload["schedule"])
    ? (payload["schedule"] as Record<string, unknown>[])
    : [];
  const sponsorsIn = Array.isArray(payload["sponsors"])
    ? (payload["sponsors"] as Record<string, unknown>[])
    : [];

  const errors: string[] = [];

  // --- Required fields ------------------------------------------------------
  const name = cleanText(ev["name"], CAP_NAME, "event.name", errors);
  if (!name) errors.push("event.name is required");

  // event_date is required; accept a YYYY-MM-DD-ish string (Postgres parses it).
  const eventDateRaw = ev["event_date"];
  let eventDate: string | null = null;
  if (typeof eventDateRaw === "string" && eventDateRaw.trim()) {
    eventDate = eventDateRaw.trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(eventDate)) {
      errors.push("event.event_date must be an ISO date (YYYY-MM-DD)");
    }
  } else {
    errors.push("event.event_date is required");
  }

  // --- Optional parent fields ----------------------------------------------
  const city = cleanText(ev["city"], CAP_FIELD, "event.city", errors);
  const eventType = cleanText(
    ev["event_type"],
    CAP_FIELD,
    "event.event_type",
    errors,
  );
  const description = cleanText(
    ev["description"],
    CAP_DESC,
    "event.description",
    errors,
  );
  const location = cleanText(ev["location"], CAP_FIELD, "event.location", errors);
  const venueName = cleanText(
    ev["venue_name"],
    CAP_FIELD,
    "event.venue_name",
    errors,
  );
  const timeRange = cleanText(
    ev["time_range"],
    CAP_FIELD,
    "event.time_range",
    errors,
  );
  const link = cleanUrl(ev["link"], CAP_FIELD, "event.link", errors);
  const imageUrl = cleanUrl(ev["image_url"], CAP_FIELD, "event.image_url", errors);
  // reviewerNotes -> events.notes (FREE-TEXT reviewer comments only — never a
  // speakers/schedule/sponsors summary, which now live in the child tables).
  const reviewerNotes = cleanText(
    ev["reviewerNotes"],
    CAP_NOTES,
    "event.reviewerNotes",
    errors,
  );

  // Optional submitter email (validated only if present).
  const submitterEmail = cleanText(ev["email"], CAP_FIELD, "event.email", errors);
  if (submitterEmail && !EMAIL_RE.test(submitterEmail)) {
    errors.push("event.email is not a valid email address");
  }

  // --- Array caps -----------------------------------------------------------
  if (speakersIn.length > CAP_ARRAY) errors.push(`too many speakers (max ${CAP_ARRAY})`);
  if (scheduleIn.length > CAP_ARRAY) errors.push(`too many schedule blocks (max ${CAP_ARRAY})`);
  if (sponsorsIn.length > CAP_ARRAY) errors.push(`too many sponsors (max ${CAP_ARRAY})`);

  // --- Build child rows (mapping client keys -> table columns) --------------
  // speaker.photo -> photo_url ; schedule.time -> start_time (end_time null,
  // keep speaker) ; sponsor.name -> sponsor_name, sponsor.url -> sponsor_url,
  // sponsor.logo -> logo_url, tier -> tier. sort_order = array index.
  const speakerRows = speakersIn.map((s, i) => ({
    name: cleanText(s["name"], CAP_FIELD, `speakers[${i}].name`, errors),
    role: cleanText(s["role"], CAP_FIELD, `speakers[${i}].role`, errors),
    org: cleanText(s["org"], CAP_FIELD, `speakers[${i}].org`, errors),
    photo_url: cleanUrl(s["photo"], CAP_FIELD, `speakers[${i}].photo`, errors),
    sort_order: i,
  }));

  const scheduleRows = scheduleIn.map((b, i) => ({
    start_time: cleanText(b["time"], CAP_FIELD, `schedule[${i}].time`, errors),
    end_time: null,
    title: cleanText(b["title"], CAP_FIELD, `schedule[${i}].title`, errors),
    speaker: cleanText(b["speaker"], CAP_FIELD, `schedule[${i}].speaker`, errors),
    sort_order: i,
  }));

  const sponsorRows = sponsorsIn.map((s, i) => ({
    sponsor_name: cleanText(s["name"], CAP_FIELD, `sponsors[${i}].name`, errors),
    sponsor_url: cleanUrl(s["url"], CAP_FIELD, `sponsors[${i}].url`, errors),
    logo_url: cleanUrl(s["logo"], CAP_FIELD, `sponsors[${i}].logo`, errors),
    tier: cleanText(s["tier"], CAP_FIELD, `sponsors[${i}].tier`, errors),
    sort_order: i,
  }));

  // Each speaker/sponsor must at least have a name (NOT NULL columns).
  speakerRows.forEach((r, i) => {
    if (!r.name) errors.push(`speakers[${i}].name is required`);
  });
  sponsorRows.forEach((r, i) => {
    if (!r.sponsor_name) errors.push(`sponsors[${i}].name is required`);
  });

  if (errors.length) {
    return json({ error: "Validation failed", details: errors }, 400);
  }

  // --- Service-role client --------------------------------------------------
  // SUPABASE_URL + the SERVICE_ROLE key are read from the Edge Function env
  // (server-side secrets, NEVER shipped to the browser). This is the only key
  // with write access to events + the child tables.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // --- Insert parent event (status FORCED to 'submitted') -------------------
  // The client can NEVER set status — moderation gate. source records the
  // submitter for the /admin queue, matching the existing 'submitted:<email>'
  // convention from submit-event/index.html.
  const { data: inserted, error: insertErr } = await supabase
    .from("events")
    .insert({
      name,
      event_date: eventDate,
      city,
      event_type: eventType,
      description,
      location,
      venue_name: venueName,
      time_range: timeRange,
      link,
      image_url: imageUrl,
      notes: reviewerNotes, // free-text reviewer comments ONLY
      status: "submitted", // moderation gate — never client-controlled
      is_external: false,
      is_featured: false,
      source: "submitted:" + (submitterEmail || "unknown"),
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return json({ error: "Failed to create event", details: insertErr?.message }, 500);
  }

  const eventId = inserted.id as number;

  // --- Insert child rows with the returned event id -------------------------
  // On any child-insert failure, surface an error (the parent already exists;
  // we report the failure so the caller/admin can reconcile).
  async function insertChildren(
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<string | null> {
    if (!rows.length) return null;
    const withFk = rows.map((r) => ({ ...r, event_id: eventId }));
    const { error } = await supabase.from(table).insert(withFk);
    return error ? `${table}: ${error.message}` : null;
  }

  const childErrors = (
    await Promise.all([
      insertChildren("event_speakers", speakerRows),
      insertChildren("event_schedule", scheduleRows),
      insertChildren("event_sponsors", sponsorRows),
    ])
  ).filter((e): e is string => e !== null);

  if (childErrors.length) {
    return json(
      { error: "Event created but child rows failed", id: eventId, details: childErrors },
      500,
    );
  }

  // Return the new event id so the page can confirm.
  return json({ ok: true, id: eventId });
});
