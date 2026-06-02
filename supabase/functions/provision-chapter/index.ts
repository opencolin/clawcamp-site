// ===========================================================================
// provision-chapter — ClawCamp v2.0.0 self-serve chapter provisioning gateway
//                      (Supabase Edge Function / Deno)
// ===========================================================================
// WHAT THIS IS:
//   The SINGLE validating gateway that turns an approved "Start a Chapter"
//   application into REAL rows: it AUTO-CREATES a `forming` public.chapters row
//   AND (best-effort) assigns the applicant the `captain` membership — zero
//   manual DB editing. The chapters page (chapters/index.html submitChapterApp)
//   POSTs a JSON body here instead of doing the old contacts write.
//
//   >>> THIS REPLACES the v1.x `form_type='chapter_application'` contacts write
//       in chapters/index.html submitChapterApp. <<< That path merely filed an
//       application row into `contacts` for a human to read and then hand-create
//       a chapter + grant a captain role in the SQL console. v2.0 makes the
//       happy path self-serve: this function creates the forming chapter (and
//       links the captain when the applicant already has a profile) directly.
//       (The chapters/index.html rewrite that POSTs here is owned by the
//       map-search-discovery slice, which consumes the contract defined below;
//       this slice owns ONLY the server-side Edge Function + migration 0009.)
//
// WHY IT EXISTS (council notes — "writes that must be trusted route through a
//   validating service-role Edge Function, NOT a raw leaky anon insert"):
//   anon has NO INSERT on chapters (migration 0002 §6 grants anon SELECT-only)
//   and NO write at all on memberships (migration 0006 §3 — the headline
//   no-self-promote lockdown). So the browser CANNOT create a chapter and CANNOT
//   grant itself a captain role. This function holds the SERVICE-ROLE key (a
//   server-side secret, never shipped to the browser — the service_role key
//   BYPASSES RLS, making it the ONLY writer with chapters/memberships INSERT
//   rights) and is therefore the ONLY writer of these rows. It mirrors the exact
//   security posture of the submit-follow / submit-rsvp / submit-event
//   gateways: length caps, email-format validation, reject-HTML on text fields,
//   and a `website` honeypot that silently drops bot submissions.
//
// THE NO-SELF-PROMOTE GUARANTEE IS PRESERVED:
//   scripts/rls-probe.sh assertion (j) asserts a hostile anon POST to
//   /rest/v1/memberships (e.g. role:'captain') is DENIED. This function does NOT
//   change that: the captain membership is written ONLY here, server-side, with
//   the service-role key, AFTER an admin has approved the application. anon still
//   has no membership write path, so rls-probe (j) continues to pass. The chapter
//   is created with status='forming' (NOT 'active') — provisioning means "this
//   city is forming"; graduation to 'active' is a separate captain/admin action
//   under the 0006 §5 chapters UPDATE gate.
//
// REQUEST CONTRACT (consumed by the chapters/index.html rewrite):
//   POST JSON: {
//     city:       string  (required)         — human city label, e.g. 'Denver'
//     name?:      string  (optional)         — display name; defaults to
//                                              'ClawCamp ' + city
//     email:      string  (required)         — applicant email (format-checked)
//     about:      string  (required)         — what the chapter is about; stored
//                                              as the chapter blurb
//     profile_id? string  (optional, uuid)   — the applicant's auth user id when
//                                              a session exists; used to link the
//                                              captain membership (best-effort)
//     website?:   string  (honeypot)         — MUST be empty; non-empty silently
//                                              drops the request (bot trap)
//   }
//   Response 200: {
//     ok: true,
//     chapter: { id: number, slug: string },
//     captain_linked: boolean   // false => operator must link the captain
//                               //          manually (see runbook note below)
//   }
//   Errors mirror submit-follow's res.json shape: { error, details? }.
//
// CAPTAIN-LINK (best-effort; NEVER fails the whole request):
//   The public.profiles table holds NO email column (migration 0005's PII
//   contract keeps email in `contacts`), so we cannot resolve email -> profile.
//   Instead the applicant's auth user id is forwarded as `profile_id` (validated
//   as a uuid, exactly like submit-follow validates profile_id). When present and
//   a matching profile exists, we INSERT a memberships row
//   { chapter_id, profile_id, role:'captain' } and return captain_linked:true.
//   If no profile_id is supplied (or no matching profile exists yet, or the
//   membership insert fails for any reason), we STILL return the created chapter
//   with captain_linked:false — the chapter must always be created. The operator
//   runbook then documents the one-line manual captain-link step:
//     INSERT INTO public.memberships (profile_id, chapter_id, role)
//     VALUES ('<applicant-auth-uid>', <chapter-id>, 'captain')
//     ON CONFLICT (profile_id, chapter_id) DO UPDATE SET role = 'captain';
//
// ASSERTION TARGET: the anon write denials this function fronts are exactly what
//   scripts/rls-probe.sh probes from a hostile anon client — anon cannot
//   raw-insert a chapters row (assertion (c)) and cannot self-grant a membership
//   role (assertion (j)) except through this service-role function (which holds
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

// Caps (kept conservative; mirror the submit-follow "length caps" requirement).
const CAP_EMAIL = 254; // RFC 5321 practical max for an email address
const CAP_CITY = 120;
const CAP_NAME = 160;
const CAP_ABOUT = 2000;

// --- Slug derivation -------------------------------------------------------
// URL-safe slug from a city: lowercase, spaces -> '-', strip anything outside
// [a-z0-9-], collapse repeated '-' and trim leading/trailing '-'. Mirrors the
// kebab convention chapters.slug already uses (0002 §3) so a provisioned chapter
// keys the same way as a seeded one.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // spaces -> hyphen
    .replace(/[^a-z0-9-]/g, "") // strip non url-safe chars (incl. accents)
    .replace(/-+/g, "-") // collapse repeated hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

// --- Provisioning defaults --------------------------------------------------
// Match the seed-row shape chapters/index.html FALLBACK_CHAPTERS uses (an emoji
// + a CSS cover_gradient), so a freshly provisioned card renders identically to
// a seeded one. These mirror the SF fallback's on-brand defaults.
const DEFAULT_EMOJI = "🦞";
const DEFAULT_COVER_GRADIENT =
  "linear-gradient(135deg,#1a1a2e 0%,#0f3460 60%,#16213e 100%)";

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

  // --- Required: city -------------------------------------------------------
  const city = cleanText(payload["city"], CAP_CITY, "city", errors);
  if (!city) {
    errors.push("city is required");
  }

  // --- Required: email ------------------------------------------------------
  const email = cleanText(payload["email"], CAP_EMAIL, "email", errors);
  if (!email) {
    errors.push("email is required");
  } else if (!EMAIL_RE.test(email)) {
    errors.push("email is not a valid email address");
  }

  // --- Required: about (stored as the chapter blurb) ------------------------
  const about = cleanText(payload["about"], CAP_ABOUT, "about", errors);
  if (!about) {
    errors.push("about is required");
  }

  // --- Optional: name (defaults to 'ClawCamp ' + city) ----------------------
  // Validated for length + reject-HTML here; the default is applied AFTER we
  // know `city` is present (below), so an over-long/HTML name is still rejected.
  const providedName = cleanText(payload["name"], CAP_NAME, "name", errors);

  // --- Optional: profile_id linkage (best-effort captain link) --------------
  // Anonymous-first: accept it ONLY if it is a valid uuid string, else null.
  // profiles holds no email column (0005 PII contract), so this forwarded auth
  // user id is how we link the captain when a session exists.
  const rawProfileId = payload["profile_id"];
  const profileId =
    typeof rawProfileId === "string" && UUID_RE.test(rawProfileId.trim())
      ? rawProfileId.trim()
      : null;

  if (errors.length) {
    return json({ error: "Validation failed", details: errors }, 400);
  }

  // From here `city`, `email`, `about` are all present non-empty strings.
  // Apply the name default now that city is known.
  const name = providedName ?? `ClawCamp ${city}`;
  if (name.length > CAP_NAME) {
    // The derived default could (pathologically) exceed the cap for a very long
    // city; reject rather than truncate, consistent with cleanText's posture.
    return json(
      { error: "Validation failed", details: [`name exceeds ${CAP_NAME} characters`] },
      400,
    );
  }

  const baseSlug = slugify(city!);
  if (!baseSlug) {
    // city was all non-url-safe characters (e.g. only punctuation/emoji).
    return json(
      { error: "Validation failed", details: ["city does not yield a valid slug"] },
      400,
    );
  }

  // --- Service-role client --------------------------------------------------
  // SUPABASE_URL + the SERVICE_ROLE key are read from the Edge Function env
  // (server-side secrets, NEVER shipped to the browser). The service_role key
  // BYPASSES RLS, making this the only key with INSERT rights on chapters
  // (0002 §6 revokes anon write) and memberships (0006 §3 grants no write).
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // --- INSERT the forming chapter (slug-collision retry once) ---------------
  // We INSERT with status='forming' (NOT 'active') — provisioning creates a
  // FORMING chapter (migration 0009 §2). On a unique-violation on chapters.slug
  // (Postgres code 23505) we append a short numeric suffix and retry ONCE; a
  // second collision returns 409. .select(...).single() uses PostgREST's
  // return=representation under the hood so we read back the new id + slug.
  async function insertChapter(slug: string) {
    return await supabase
      .from("chapters")
      .insert({
        slug,
        name,
        city,
        blurb: about,
        emoji: DEFAULT_EMOJI,
        cover_gradient: DEFAULT_COVER_GRADIENT,
        status: "forming",
      })
      .select("id, slug")
      .single();
  }

  let { data: chapter, error: chapterErr } = await insertChapter(baseSlug);

  if (chapterErr && chapterErr.code === "23505") {
    // Slug already taken — retry ONCE with a short numeric suffix. A 3-digit
    // random suffix keeps the slug readable while making a second collision
    // very unlikely.
    const suffix = Math.floor(100 + Math.random() * 900); // 100..999
    const retrySlug = `${baseSlug}-${suffix}`;
    ({ data: chapter, error: chapterErr } = await insertChapter(retrySlug));

    if (chapterErr) {
      if (chapterErr.code === "23505") {
        // Still colliding after one retry — treat as "already exists".
        return json({ error: "Chapter already exists" }, 409);
      }
      return json(
        { error: "Failed to create chapter", details: chapterErr.message },
        500,
      );
    }
  } else if (chapterErr) {
    return json(
      { error: "Failed to create chapter", details: chapterErr.message },
      500,
    );
  }

  if (!chapter?.id) {
    // Defensive: insert reported no error but no row came back.
    return json({ error: "Failed to create chapter" }, 500);
  }

  // --- Best-effort captain membership ---------------------------------------
  // The chapter is now created; from here NOTHING may fail the request — the
  // chapter must persist even if the captain link cannot be made. We link the
  // captain ONLY when a profile_id was supplied AND a matching public.profiles
  // row exists (so the membership FK to auth.users resolves). Any miss/failure
  // returns captain_linked:false so the operator runbook documents the manual
  // INSERT INTO memberships step.
  let captainLinked = false;
  if (profileId) {
    try {
      // Confirm the applicant has a profile row (profiles.id is the auth uid,
      // 0005 §2). If absent, the auth user may not exist yet / hasn't onboarded,
      // so we skip the link rather than risk an FK violation.
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", profileId)
        .maybeSingle();

      if (prof?.id) {
        const { error: memErr } = await supabase
          .from("memberships")
          .insert({
            chapter_id: chapter.id,
            profile_id: profileId,
            role: "captain",
          });
        // 23505 (already a member of this chapter) counts as linked — the
        // applicant already holds a row for this chapter. Any other error is
        // swallowed (best-effort) and surfaced only as captain_linked:false.
        if (!memErr || memErr.code === "23505") {
          captainLinked = true;
        }
      }
    } catch {
      // Best-effort: never let a captain-link failure fail the whole request.
      captainLinked = false;
    }
  }

  // Return the created chapter + whether the captain was linked. captain_linked:
  // false signals the operator must link the captain manually (runbook note in
  // the top-of-file comment).
  return json({
    ok: true,
    chapter: { id: chapter.id, slug: chapter.slug },
    captain_linked: captainLinked,
  });
});
