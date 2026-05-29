import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CONFIRM_PREFIX = "DELETE-";

type DeleteAccountBody = {
  confirmation?: string;
};

function jsonHeaders() {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders() });
  }

  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders() });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: jsonHeaders() });
  }

  let body: DeleteAccountBody;
  try {
    body = (await req.json()) as DeleteAccountBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const confirmation = (body.confirmation ?? "").trim();
  if (!confirmation) {
    return new Response(JSON.stringify({ error: "Confirmation required" }), { status: 400, headers: jsonHeaders() });
  }

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders() });
  }

  const userId = userData.user.id;
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return new Response(JSON.stringify({ error: "Could not load profile" }), { status: 500, headers: jsonHeaders() });
  }

  const username = (profile?.username ?? "").trim().toLowerCase();
  if (!username) {
    return new Response(JSON.stringify({ error: "Username required" }), { status: 400, headers: jsonHeaders() });
  }

  const expected = `${CONFIRM_PREFIX}${username}`;
  if (confirmation !== expected) {
    return new Response(JSON.stringify({ error: "Invalid confirmation" }), { status: 400, headers: jsonHeaders() });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message ?? "Delete failed" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
});
