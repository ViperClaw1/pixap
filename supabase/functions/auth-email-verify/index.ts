import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildVerifyEmailHtml } from "../_shared/authEmailTemplates.ts";
import { isValidEmail, jsonHeaders, normalizeEmail, withFlowQuery } from "../_shared/authEmail.ts";
import { sendResendEmail } from "../_shared/resend.ts";

type VerifyBody = {
  email?: string;
  redirectTo?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders() });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: jsonHeaders() });
  }

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const email = normalizeEmail(body.email);
  const redirectTo = (body.redirectTo ?? "").trim();
  if (!email || !redirectTo || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email or redirect URL" }), { status: 400, headers: jsonHeaders() });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    // Use magiclink for existing users; signup links may fail once account already exists/confirmed.
    type: "magiclink",
    email,
    options: {
      redirectTo: withFlowQuery(redirectTo, "verify"),
    },
  });

  if (linkError || !linkData.properties?.action_link) {
    return new Response(JSON.stringify({ error: linkError?.message ?? "Failed to generate verify link" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  try {
    await sendResendEmail({
      to: email,
      subject: "Verify your Pixap email",
      html: buildVerifyEmailHtml(linkData.properties.action_link),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send verification email";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
});

