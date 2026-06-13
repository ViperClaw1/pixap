import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isServiceAuthorized, resolveSupabaseSecretKey } from "../_shared/serviceAuth.ts";

function isReminderCronAuthorized(req: Request, serviceKey: string): boolean {
  const reminderSecret = Deno.env.get("REMINDER_CRON_SECRET");
  if (reminderSecret) {
    const provided = req.headers.get("x-reminder-cron-secret") ?? req.headers.get("x-cron-secret") ?? "";
    if (provided === reminderSecret) return true;
  }
  return isServiceAuthorized(req, serviceKey);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = resolveSupabaseSecretKey();
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }
  if (!isReminderCronAuthorized(req, serviceKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);

  const { data: bookings, error } = await admin
    .from("bookings")
    .select("id, user_id, date_time, persons, customer_name, business_card_id, business_cards(name)")
    .eq("status", "upcoming")
    .is("reminder_sent_at", null)
    .gte("date_time", windowStart.toISOString())
    .lte("date_time", windowEnd.toISOString());

  if (error) {
    console.error("[booking-reminder-cron] query error:", error);
    return jsonResponse({ error: error.message }, 500);
  }

  const results: { id: string; push: boolean; email: boolean }[] = [];

  for (const booking of bookings ?? []) {
    const businessCards = booking.business_cards as { name: string } | { name: string }[] | null;
    const venueName = Array.isArray(businessCards)
      ? businessCards[0]?.name
      : businessCards?.name ?? "your booking";
    const timeStr = new Date(booking.date_time).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Almaty",
    });

    const { error: pushErr } = await admin.from("push_outbox").insert({
      user_id: booking.user_id,
      title: "⏰ Reminder",
      body: `Your booking at ${venueName} is in 1 hour (${timeStr})`,
      data: {
        kind: "booking_reminder",
        booking_id: booking.id,
        business_card_id: booking.business_card_id,
      },
    });

    const pushOk = !pushErr;
    if (pushErr) console.error("[booking-reminder-cron] push_outbox:", pushErr);

    let emailOk = false;
    try {
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-booking-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ booking_id: booking.id, kind: "reminder" }),
      });
      emailOk = emailRes.ok;
      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("[booking-reminder-cron] email:", emailRes.status, errText.slice(0, 300));
      }
    } catch (e) {
      console.error("[booking-reminder-cron] email:", e);
    }

    const { error: markErr } = await admin
      .from("bookings")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", booking.id);

    if (markErr) {
      console.error("[booking-reminder-cron] reminder_sent_at:", markErr);
    }

    results.push({ id: booking.id, push: pushOk, email: emailOk });
  }

  console.log(`[booking-reminder-cron] processed ${results.length} reminders`);
  return jsonResponse({ ok: true, processed: results.length, results });
});
