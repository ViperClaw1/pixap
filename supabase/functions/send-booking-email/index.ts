import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  buildReminderEmail,
  buildStatusEmail,
  formatBookingDateTime,
} from "../_shared/bookingEmailTemplates.ts";
import { isServiceAuthorized, resolveSupabaseSecretKey } from "../_shared/serviceAuth.ts";
import { sendResendEmail } from "../_shared/resend.ts";

type ReqBody = {
  booking_id: string;
  kind: "reminder" | "status_update";
};

const APP_URL = "https://pixapp.kz";

function deepLink(bookingId: string): string {
  return `${APP_URL}/bookings/${bookingId}`;
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

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = resolveSupabaseSecretKey();
  if (!url || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }
  if (!await isServiceAuthorized(req, serviceKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const { booking_id, kind } = body;
  if (!booking_id || !kind) {
    return jsonResponse({ error: "Missing booking_id or kind" }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: booking, error: bookErr } = await admin
    .from("bookings")
    .select(`
      id,
      user_id,
      date_time,
      persons,
      status,
      customer_email,
      customer_name,
      business_cards ( name )
    `)
    .eq("id", booking_id)
    .single();

  if (bookErr || !booking) {
    return jsonResponse({ error: "Booking not found" }, 404);
  }

  const { data: authUser } = await admin.auth.admin.getUserById(booking.user_id);
  const toEmail =
    booking.customer_email?.trim() ||
    authUser?.user?.email?.trim();

  if (!toEmail) {
    return jsonResponse({ ok: true, skipped: "no_email" });
  }

  const businessCards = booking.business_cards as { name: string } | { name: string }[] | null;
  const venueName = Array.isArray(businessCards)
    ? businessCards[0]?.name
    : businessCards?.name ?? "your venue";
  const customerName =
    booking.customer_name ||
    (authUser?.user?.user_metadata?.first_name as string | undefined) ||
    "";
  const dateTimeStr = formatBookingDateTime(booking.date_time);

  let subject: string;
  let html: string;

  if (kind === "reminder") {
    subject = `⏰ Reminder: ${venueName} in 1 hour`;
    html = buildReminderEmail({
      customerName,
      venueName,
      dateTime: dateTimeStr,
      persons: booking.persons ?? 1,
      bookingId: booking_id,
      deepLink: deepLink(booking_id),
    });
  } else {
    subject =
      booking.status === "upcoming"
        ? `✅ Booking confirmed — ${venueName}`
        : booking.status === "completed"
        ? `🌟 Thanks for visiting ${venueName}!`
        : `⌛ Booking expired — ${venueName}`;

    html = buildStatusEmail({
      customerName,
      venueName,
      dateTime: dateTimeStr,
      status: booking.status as "upcoming" | "completed" | "expired",
      deepLink: deepLink(booking_id),
    });
  }

  await sendResendEmail({ to: toEmail, subject, html });

  return jsonResponse({ ok: true, to: toEmail, kind });
});
