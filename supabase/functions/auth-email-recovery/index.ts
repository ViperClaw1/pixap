import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildRecoveryEmailHtml } from "../_shared/authEmailTemplates.ts";
import { isValidEmail, jsonHeaders, normalizeEmail, withFlowQuery } from "../_shared/authEmail.ts";
import { sendResendEmail } from "../_shared/resend.ts";

type RecoveryBody = {
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
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
  }

  let body: RecoveryBody;
  try {
    body = (await req.json()) as RecoveryBody;
  } catch {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
  }

  const email = normalizeEmail(body.email);
  const redirectTo = (body.redirectTo ?? "").trim();
  if (!email || !redirectTo || !isValidEmail(email)) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: withFlowQuery(redirectTo, "recovery"),
    },
  });

  if (!linkError && linkData.properties?.action_link) {
    await sendResendEmail({
      to: email,
      subject: "Reset your Pixap password",
      html: buildRecoveryEmailHtml(linkData.properties.action_link),
    }).catch(() => undefined);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
});
