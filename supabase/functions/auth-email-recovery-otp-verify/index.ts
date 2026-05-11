import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isValidEmail, jsonHeaders, normalizeEmail } from "../_shared/authEmail.ts";

type RecoveryVerifyBody = {
  email?: string;
  code?: string;
};

type OtpRow = {
  id: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
};

type ProfileRow = {
  id: string;
};

const OTP_TABLE = "email_verification_otp_codes";
const MAX_ATTEMPTS = 5;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashOtp(code: string, secret: string): Promise<string> {
  const payload = new TextEncoder().encode(`${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return toHex(digest);
}

function extractTokenHash(actionLink: string | null | undefined): string | null {
  if (!actionLink) return null;
  try {
    const url = new URL(actionLink);
    return url.searchParams.get("token_hash");
  } catch {
    return null;
  }
}

type GenerateLinkData = {
  properties?: {
    action_link?: string | null;
    hashed_token?: string | null;
  } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders() });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const otpSecret = Deno.env.get("EMAIL_OTP_SECRET") ?? "";
  if (!url || !serviceRoleKey || !otpSecret || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: jsonHeaders() });
  }

  let body: RecoveryVerifyBody;
  try {
    body = (await req.json()) as RecoveryVerifyBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const email = normalizeEmail(body.email);
  const code = (body.code ?? "").trim();
  if (!email || !isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ error: "Invalid verification payload" }), { status: 400, headers: jsonHeaders() });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<ProfileRow>();

  if (!profile?.id) {
    return new Response(JSON.stringify({ error: "Incorrect verification code" }), { status: 400, headers: jsonHeaders() });
  }

  const { data: otpRow, error: otpFetchError } = await admin
    .from(OTP_TABLE)
    .select("id, code_hash, attempts, expires_at")
    .eq("user_id", profile.id)
    .eq("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<OtpRow>();

  if (otpFetchError || !otpRow) {
    return new Response(JSON.stringify({ error: "Incorrect verification code" }), { status: 400, headers: jsonHeaders() });
  }

  if (otpRow.attempts >= MAX_ATTEMPTS) {
    return new Response(JSON.stringify({ error: "Too many attempts. Request a new code." }), {
      status: 429,
      headers: jsonHeaders(),
    });
  }

  if (new Date(otpRow.expires_at).getTime() <= Date.now()) {
    await admin.from(OTP_TABLE).update({ used_at: new Date().toISOString() }).eq("id", otpRow.id);
    return new Response(JSON.stringify({ error: "Code expired. Request a new code." }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const codeHash = await hashOtp(code, otpSecret);
  if (codeHash !== otpRow.code_hash) {
    await admin.from(OTP_TABLE).update({ attempts: otpRow.attempts + 1 }).eq("id", otpRow.id);
    return new Response(JSON.stringify({ error: "Incorrect verification code" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const usedAt = new Date().toISOString();
  const { error: markOtpError } = await admin.from(OTP_TABLE).update({ used_at: usedAt }).eq("id", otpRow.id);
  if (markOtpError) {
    return new Response(JSON.stringify({ error: "Failed to verify reset code" }), { status: 500, headers: jsonHeaders() });
  }

  const { data: rawLinkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  const linkData = rawLinkData as GenerateLinkData | null;
  const tokenHash = linkData?.properties?.hashed_token ?? extractTokenHash(linkData?.properties?.action_link) ?? null;
  if (linkError || !tokenHash) {
    return new Response(JSON.stringify({ error: linkError?.message ?? "Failed to initialize recovery session" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: verifyData, error: verifyError } = await authClient.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (verifyError || !verifyData.session?.access_token || !verifyData.session.refresh_token) {
    return new Response(JSON.stringify({ error: verifyError?.message ?? "Failed to initialize recovery session" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      },
    }),
    { status: 200, headers: jsonHeaders() },
  );
});
