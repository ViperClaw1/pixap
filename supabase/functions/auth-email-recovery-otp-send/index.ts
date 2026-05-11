import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildRecoveryOtpEmailHtml } from "../_shared/authEmailTemplates.ts";
import { isValidEmail, jsonHeaders, normalizeEmail } from "../_shared/authEmail.ts";
import { sendResendEmail } from "../_shared/resend.ts";

type RecoverySendBody = {
  email?: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
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

  let body: RecoverySendBody;
  try {
    body = (await req.json()) as RecoverySendBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const email = normalizeEmail(body.email);
  if (!email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: jsonHeaders() });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile } = await admin
    .from("profiles")
    .select("id, first_name")
    .eq("email", email)
    .maybeSingle<ProfileRow>();

  // Do not leak account existence.
  if (!profile?.id) {
    return new Response(JSON.stringify({ ok: true, expiresInMinutes: OTP_TTL_MINUTES }), {
      status: 200,
      headers: jsonHeaders(),
    });
  }

  const code = generateOtpCode();
  const codeHash = await hashOtp(code, otpSecret);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await admin.from(OTP_TABLE).delete().eq("user_id", profile.id).is("used_at", null);
  const { error: insertError } = await admin.from(OTP_TABLE).insert({
    user_id: profile.id,
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insertError) {
    return new Response(JSON.stringify({ error: "Failed to create reset code" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  try {
    await sendResendEmail({
      to: email,
      subject: "Password reset code",
      html: buildRecoveryOtpEmailHtml({
        code,
        name: profile.first_name ?? undefined,
        subject: "Password reset code",
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send recovery email";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(JSON.stringify({ ok: true, expiresInMinutes: OTP_TTL_MINUTES }), {
    status: 200,
    headers: jsonHeaders(),
  });
});
