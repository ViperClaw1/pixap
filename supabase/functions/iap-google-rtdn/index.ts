import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type PubSubEnvelope = {
  message?: {
    messageId?: string;
    data?: string;
    publishTime?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204 });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) throw new Error("Missing service role env");
    const admin = createClient(supabaseUrl, serviceKey);

    const bodyText = await req.text();
    const envelope = JSON.parse(bodyText) as PubSubEnvelope;
    const base64Data = envelope.message?.data;
    if (!base64Data) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });

    const decodedMessage = JSON.parse(atob(base64Data)) as {
      packageName?: string;
      eventTimeMillis?: string;
      subscriptionNotification?: {
        subscriptionId?: string;
        purchaseToken?: string;
        notificationType?: number;
      };
    };
    const notification = decodedMessage.subscriptionNotification;
    if (!notification?.purchaseToken) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    const eventId = envelope.message?.messageId ?? crypto.randomUUID();
    const notificationType = notification.notificationType ?? -1;
    await admin.from("subscription_events").upsert(
      {
        platform: "android",
        source: "google_rtdn",
        event_id: eventId,
        event_type: String(notificationType),
        event_time: decodedMessage.eventTimeMillis
          ? new Date(Number(decodedMessage.eventTimeMillis)).toISOString()
          : envelope.message?.publishTime ?? null,
        payload: decodedMessage,
        payload_hash: await sha256Hex(bodyText),
      },
      { onConflict: "platform,event_id" },
    );

    const normalizedStatus: "active" | "grace_period" | "billing_retry" | "expired" | "revoked" =
      notificationType === 12
        ? "revoked"
        : notificationType === 3 || notificationType === 13
          ? "expired"
          : notificationType === 5
            ? "grace_period"
            : notificationType === 10 || notificationType === 11
              ? "billing_retry"
              : "active";

    await admin
      .from("subscription_entitlements")
      .update({
        status: normalizedStatus,
        will_renew: normalizedStatus === "active" || normalizedStatus === "grace_period",
        updated_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      })
      .eq("platform", "android")
      .eq("purchase_token", notification.purchaseToken);

    await admin
      .from("subscription_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("platform", "android")
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[iap-google-rtdn]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
