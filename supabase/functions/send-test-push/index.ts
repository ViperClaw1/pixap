import { corsHeaders } from "../_shared/cors.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Smoke-test Expo push delivery to a single device token (ExponentPushToken[...]).
 * Set secret: `supabase secrets set TEST_PUSH_SECRET=...` and call with header `x-test-push-secret`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("TEST_PUSH_SECRET");
  if (!expected) {
    return new Response(JSON.stringify({ error: "TEST_PUSH_SECRET is not configured on the project" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-test-push-secret") ?? "";
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "Invalid x-test-push-secret" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { expo_push_token?: string; title?: string; body?: string };
  try {
    body = (await req.json()) as { expo_push_token?: string; title?: string; body?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const to = typeof body.expo_push_token === "string" ? body.expo_push_token.trim() : "";
  if (!to.startsWith("ExponentPushToken[")) {
    return new Response(JSON.stringify({ error: "expo_push_token must be an ExponentPushToken[...] value" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Pixap test";
  const msgBody = typeof body.body === "string" && body.body.trim() ? body.body.trim() : "Push channel OK";

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  const payload = [
    {
      to,
      title,
      body: msgBody,
      sound: "default",
      priority: "high",
      channelId: "pixap-default",
      data: { kind: "test_push" },
    },
  ];
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));

  return new Response(JSON.stringify({ ok: res.ok, status: res.status, expo: json }), {
    status: res.ok ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
