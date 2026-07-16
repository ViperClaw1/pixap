import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isServiceAuthorized, resolveSupabaseSecretKey } from "../_shared/serviceAuth.ts";

const BOOKING_RESPONSE_TIMEOUT_LINE = "Venue did not respond within 15 minutes.";
const BOOKING_RESPONSE_TIMEOUT_LIMIT = 100;

type BookingTimeoutRow = {
  id: string;
  user_id: string;
  business_card_id: string | null;
  response_deadline_at: string | null;
  wa_status_lines: unknown;
  business_card: { name?: string | null } | { name?: string | null }[] | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseStatusLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((line): line is string => typeof line === "string" && line.trim().length > 0);
}

async function processBookingResponseTimeouts(
  // Supabase Edge Functions here use the runtime schema, while generated local
  // types may lag behind fresh migrations; keep this helper row-normalized.
  admin: ReturnType<typeof createClient<any>>,
  now: Date,
): Promise<{ id: string; push: boolean }[]> {
  const { data: rows, error } = await admin
    .from("cart_items")
    .select("id, user_id, business_card_id, response_deadline_at, wa_status_lines, business_card:business_cards(name)")
    .eq("status", "created")
    .eq("wa_confirmable", false)
    .is("response_timed_out_at", null)
    .not("response_deadline_at", "is", null)
    .lt("response_deadline_at", now.toISOString())
    .limit(BOOKING_RESPONSE_TIMEOUT_LIMIT);

  if (error) {
    console.error("[booking-reminder-cron] response timeout query:", error);
    throw error;
  }

  const results: { id: string; push: boolean }[] = [];
  for (const row of (rows ?? []) as BookingTimeoutRow[]) {
    const statusLines = parseStatusLines(row.wa_status_lines);
    const nextStatusLines = statusLines.includes(BOOKING_RESPONSE_TIMEOUT_LINE)
      ? statusLines
      : [...statusLines, BOOKING_RESPONSE_TIMEOUT_LINE];

    const { error: updateErr } = await admin
      .from("cart_items")
      .update({
        response_timed_out_at: now.toISOString(),
        wa_status_lines: nextStatusLines,
      })
      .eq("id", row.id)
      .is("response_timed_out_at", null);

    if (updateErr) {
      console.error("[booking-reminder-cron] response timeout update:", updateErr);
      results.push({ id: row.id, push: false });
      continue;
    }

    const businessCard = row.business_card as { name?: string | null } | { name?: string | null }[] | null;
    const venueName = Array.isArray(businessCard)
      ? businessCard[0]?.name
      : businessCard?.name ?? "the venue";
    const { error: pushErr } = await admin.from("push_outbox").insert({
      user_id: row.user_id,
      title: "No venue response yet",
      body: `${venueName} did not respond within 15 minutes. Pix AI can find similar options.`,
      data: {
        kind: "booking_status",
        cart_item_id: row.id,
        business_card_id: row.business_card_id,
        status: "response_timeout",
      },
    });

    if (pushErr) {
      console.error("[booking-reminder-cron] response timeout push:", pushErr);
    }
    results.push({ id: row.id, push: !pushErr });
  }

  return results;
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
  if (!await isServiceAuthorized(req, serviceKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const timeoutResults = await processBookingResponseTimeouts(admin, now);
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

  console.log(
    `[booking-reminder-cron] processed ${results.length} reminders and ${timeoutResults.length} response timeouts`,
  );
  return jsonResponse({
    ok: true,
    processed: results.length,
    response_timeouts_processed: timeoutResults.length,
    results,
    response_timeout_results: timeoutResults,
  });
});
