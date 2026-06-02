// ===========================================================================
// submit-follow — ClawCamp v1.4.0 chapter-follow write gateway (Supabase Edge Function / Deno)
// ===========================================================================
// WHAT THIS IS:
//   The SINGLE validating gateway for "follow this chapter". The chapters page
//   join modal (chapters/index.html) POSTs a JSON body here instead of doing a
//   raw /rest/v1/chapter_follows insert — because there is no such anon insert
//   path. This REPLACES the v1.2 'chapter_follow contact' hack (which faked a
//   follow by writing a contacts row); a follow is now a real
//   public.chapter_follows row.
//
// WHY IT EXISTS (council notes — "writes that must be trusted route through the
//   v1.2 validating Edge Function, NOT a raw leaky anon insert"):
//   Migration 0007 grants anon NO write on the `chapter_follows` table. So the
//   browser CANNOT write a follow directly. This function holds the
//   SERVICE-ROLE key (a server-side secret, never shipped to the browser — the
//   only key with write access to chapter_follows since 0007 revokes anon
//   write) and is therefore the ONLY writer. It mirrors the security posture of
//   the submit-rsvp gateway: length caps, email-format checks, reject-HTML, and
//   a honeypot.
//
// THE PRODUCT MODEL — anonymous-email-first:
//   No login required. email (required) + optional name is enough to follow a
//   chapter. OPTIONAL account linkage: if a logged-in user's id is forwarded as
//   profile_id we attach it (best-effort, validated as a uuid); otherwise null.
//
// DUPLICATE HANDLING (documented for the frontend):
//   Migration 0007's partial unique index rejects a second follow for the same
//   (chapter_id, lower(email)). When the insert hits that unique violation
//   (Postgres code 23505) we return a friendly 200 { ok: true, already: true }
//   so the frontend can show a "you've joined" state rather than an error — a
//   repeat follow is not a failure. A bad chapter_id trips the FK
//   (Postgres code 23503) and we surface a 400 "Unknown chapter".
//
// ASSERTION TARGET: the anon write denial this function fronts is exactly what
//   scripts/rls-probe.sh probes from a hostile anon client — anon cannot
//   raw-insert a chapter_follows row except through this function (which holds
//   the service-role key + a honeypot).
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS -----------------------------------------------------------------
// The chapters page is same-project but cross-origin to *.supabase.co, so the
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

// Caps (kept conservative; mirror the submit-rsvp "length caps" requirement).
const CAP_EMAIL = 254; // RFC 5321 practical max for an email address
const CAP_NAME = 200;

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
    return json({ ok: true });
  }

  const errors: string[] = [];

  // --- Required: chapter_id -------------------------------------------------
  // Must be a positive integer — it FKs to chapters.id (bigint). Accept a number
  // or a numeric string; reject anything missing / non-numeric / non-positive.
  const rawChapterId = payload["chapter_id"];
  let chapterId: number | null = null;
  if (typeof rawChapterId === "number" && Number.isFinite(rawChapterId)) {
    chapterId = rawChapterId;
  } else if (typeof rawChapterId === "string" && rawChapterId.trim() !== "") {
    const n = Number(rawChapterId.trim());
    if (Number.isFinite(n)) chapterId = n;
  }
  if (chapterId === null || !Number.isInteger(chapterId) || chapterId <= 0) {
    errors.push("chapter_id is required and must be a positive integer");
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
  // with write access to chapter_follows since 0007 revokes anon write.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // --- Insert the follow (chapter_id validated) -----------------------------
  const { data: inserted, error: insertErr } = await supabase
    .from("chapter_follows")
    .insert({
      chapter_id: chapterId,
      email,
      name,
      profile_id: profileId,
    })
    .select("id")
    .single();

  if (insertErr) {
    // 23505 = unique_violation: the partial unique index rejected a second
    // follow for this (chapter_id, lower(email)). Surface a friendly "already
    // following" state instead of an error.
    if (insertErr.code === "23505") {
      return json({ ok: true, already: true });
    }
    // 23503 = foreign_key_violation: chapter_id doesn't exist in chapters.
    if (insertErr.code === "23503") {
      return json({ error: "Unknown chapter" }, 400);
    }
    return json(
      { error: "Failed to create follow", details: insertErr.message },
      500,
    );
  }

  // Return the new id so the page can confirm.
  return json({ ok: true, id: inserted?.id ?? null });
});
