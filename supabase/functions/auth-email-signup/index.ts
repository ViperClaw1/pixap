import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isValidEmail, jsonHeaders, normalizeEmail } from "../_shared/authEmail.ts";

type SignupBody = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
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

  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const email = normalizeEmail(body.email);
  const password = (body.password ?? "").trim();
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  if (!email || !password || !firstName || !lastName) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: jsonHeaders() });
  }
  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: jsonHeaders() });
  }
  if (password.length < 8) {
    return new Response(
      JSON.stringify({ error: "Password must be at least 8 characters" }),
      { status: 400, headers: jsonHeaders() },
    );
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    // Keep signup non-blocking for auth flow: user can sign in immediately.
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (createError) {
    const message = createError.message ?? "Failed to create user";
    const code = message.toLowerCase().includes("already") ? 409 : 400;
    return new Response(JSON.stringify({ error: message }), { status: code, headers: jsonHeaders() });
  }

  if (userData.user?.id) {
    await admin.from("profiles").update({ is_verified: false }).eq("id", userData.user.id);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
});
