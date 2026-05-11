import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildVerifyOtpEmailHtml } from "../_shared/authEmailTemplates.ts";
import { isValidEmail, jsonHeaders, normalizeEmail } from "../_shared/authEmail.ts";
import { sendResendEmail } from "../_shared/resend.ts";

type VerifyBody = {
  email?: string;
};

const OTP_TABLE = "email_verification_otp_codes";
const OTP_TTL_MINUTES = 10;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtpCode(): string {
  const value = Math.floor(Math.random() * 1_000_000);
  return String(value).padStart(6, "0");
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

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const email = normalizeEmail(body.email);
  if (!email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: jsonHeaders() });
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

  if (normalizeEmail(user.email) !== email) {
    return new Response(JSON.stringify({ error: "Email does not match your account" }), {
      status: 403,
      headers: jsonHeaders(),
    });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const code = generateOtpCode();
  const codeHash = await hashOtp(code, otpSecret);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const userName =
    (user.user_metadata?.first_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    undefined;

  const { error: cleanupError } = await admin
    .from(OTP_TABLE)
    .delete()
    .eq("user_id", user.id)
    .is("used_at", null);
  if (cleanupError) {
    return new Response(JSON.stringify({ error: "Failed to create verification code" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  const { error: insertError } = await admin.from(OTP_TABLE).insert({
    user_id: user.id,
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insertError) {
    return new Response(JSON.stringify({ error: "Failed to create verification code" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  try {
    await sendResendEmail({
      to: email,
      subject: "Verify your email",
      html: buildVerifyOtpEmailHtml({ code, name: userName, subject: "Verify your email" }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send verification email";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(JSON.stringify({ ok: true, expiresInMinutes: OTP_TTL_MINUTES }), { status: 200, headers: jsonHeaders() });
});

