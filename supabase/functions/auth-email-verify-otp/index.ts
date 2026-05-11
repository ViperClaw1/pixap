import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonHeaders } from "../_shared/authEmail.ts";

type VerifyOtpBody = {
  code?: string;
};

type OtpRow = {
  id: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders() });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const otpSecret = Deno.env.get("EMAIL_OTP_SECRET") ?? "";
  if (!url || !serviceRoleKey || !otpSecret) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: jsonHeaders() });
  }

  let body: VerifyOtpBody;
  try {
    body = (await req.json()) as VerifyOtpBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const code = (body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ error: "Invalid verification code" }), { status: 400, headers: jsonHeaders() });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders() });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders() });
  }

  const authedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await authedClient.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders() });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: otpRow, error: otpFetchError } = await admin
    .from(OTP_TABLE)
    .select("id, code_hash, attempts, expires_at")
    .eq("user_id", user.id)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<OtpRow>();

  if (otpFetchError || !otpRow) {
    return new Response(JSON.stringify({ error: "Invalid verification code" }), { status: 400, headers: jsonHeaders() });
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
    await admin
      .from(OTP_TABLE)
      .update({ attempts: otpRow.attempts + 1 })
      .eq("id", otpRow.id);
    return new Response(JSON.stringify({ error: "Incorrect verification code" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const usedAt = new Date().toISOString();
  const { error: markOtpError } = await admin.from(OTP_TABLE).update({ used_at: usedAt }).eq("id", otpRow.id);
  if (markOtpError) {
    return new Response(JSON.stringify({ error: "Failed to verify email" }), { status: 500, headers: jsonHeaders() });
  }

  const { error: profileUpdateError } = await admin.from("profiles").update({ is_verified: true }).eq("id", user.id);
  if (profileUpdateError) {
    return new Response(JSON.stringify({ error: "Failed to verify email" }), { status: 500, headers: jsonHeaders() });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
});
