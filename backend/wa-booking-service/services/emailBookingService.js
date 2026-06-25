const { syncCartOrLegacy } = require("./bookingNotify");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.BOOKING_EMAIL_FROM || "bookings@pixapp.kz";
const BASE_URL = (process.env.APP_BASE_URL || "https://api.pixapp.kz").replace(/\/$/, "");

const emailBookingsById = new Map();

function log(action, details) {
  console.log(
    JSON.stringify({
      scope: "email_booking_service",
      action,
      ...details,
      timestamp: new Date().toISOString(),
    }),
  );
}

function emailStatusLines(appLocale, key) {
  const lines = {
    en: {
      sent: ["Email sent to venue. Waiting for reply…"],
      email_failed: ["Could not send email to venue. Please contact support."],
      confirmed: ["Venue confirmed availability by email.", "You can confirm the booking in the app."],
      declined: ["Venue declined your booking request by email."],
    },
    ru: {
      sent: ["Email отправлен в заведение. Ожидаем ответ…"],
      email_failed: ["Не удалось отправить email в заведение. Обратитесь в поддержку."],
      confirmed: ["Заведение подтвердило доступность по email.", "Можно подтвердить бронь в приложении."],
      declined: ["Заведение отклонило запрос на бронирование по email."],
    },
  };
  const table = appLocale === "ru" ? lines.ru : lines.en;
  return table[key] ?? lines.en[key] ?? [];
}

function buildEmailHtml(booking) {
  const { venue_name, customer_name, date, time, id } = booking;
  const guest = customer_name || "a guest";
  const confirmUrl = `${BASE_URL}/functions/v1/email-booking-confirm?booking_id=${encodeURIComponent(id)}&action=confirm`;
  const declineUrl = `${BASE_URL}/functions/v1/email-booking-confirm?booking_id=${encodeURIComponent(id)}&action=decline`;

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="margin-bottom:8px;">Booking Request via Pixap</h2>
  <p style="color:#6b7280;margin-top:0;">Please review and respond to this reservation request.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;width:120px;">Venue</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">${venue_name}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;">Guest</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${guest}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;">Date</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${date}</td></tr>
    <tr><td style="padding:8px 0;color:#6b7280;">Time</td><td style="padding:8px 0;">${time}</td></tr>
  </table>
  <div style="margin:24px 0;display:flex;gap:12px;">
    <a href="${confirmUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-right:12px;">✓ Confirm availability</a>
    <a href="${declineUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">✗ Not available</a>
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;">
    Booking reference: ${id}<br>
    Sent via <a href="https://pixapp.kz" style="color:#9ca3af;">Pixap</a> booking platform.
    You received this because a guest used Pixap to request a table at your venue.
  </p>
</body>
</html>`;
}

async function sendEmail(toEmail, subject, htmlBody) {
  if (!RESEND_API_KEY) {
    log("email_not_configured", { hint: "Set RESEND_API_KEY env var on Railway." });
    return null;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: toEmail, subject, html: htmlBody }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend ${response.status}: ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  return { message_id: data.id };
}

function makeEmailBookingSnapshot(booking) {
  return {
    id: booking.id,
    channel: "email",
    status: booking.status,
    contact_email: booking.contact_email,
  };
}

async function createEmailBooking(payload) {
  const {
    id: bookingId,
    venue_name,
    date,
    time,
    contact_email,
    customer_name,
    app_interface_locale,
    supabase_callback_url,
    supabase_callback_token,
    fallback_from,
  } = payload;

  if (emailBookingsById.has(bookingId)) {
    log("email_booking_already_exists", { booking_id: bookingId });
    return makeEmailBookingSnapshot(emailBookingsById.get(bookingId));
  }

  const appLocale = app_interface_locale === "ru" ? "ru" : "en";

  const booking = {
    id: bookingId,
    channel: "email",
    venue_name,
    date,
    time,
    contact_email,
    customer_name: customer_name || null,
    app_interface_locale: appLocale,
    supabase_callback_url: supabase_callback_url || null,
    supabase_callback_token: supabase_callback_token || null,
    status: "pending",
    fallback_from: fallback_from || null,
    created_at: new Date().toISOString(),
  };

  emailBookingsById.set(bookingId, booking);
  log("email_booking_created", { booking_id: bookingId, contact_email, fallback_from });

  const subject = `Booking request — ${venue_name}, ${date} at ${time}`;

  try {
    await sendEmail(contact_email, subject, buildEmailHtml(booking));
  } catch (err) {
    log("email_send_error", { booking_id: bookingId, error: String(err) });
    booking.status = "email_failed";
    await syncCartOrLegacy(
      booking,
      { status_lines: emailStatusLines(appLocale, "email_failed"), confirmable: false },
      { booking_id: bookingId, status: "email_failed", channel: "email" },
    );
    return makeEmailBookingSnapshot(booking);
  }

  await syncCartOrLegacy(
    booking,
    { status_lines: emailStatusLines(appLocale, "sent"), confirmable: false },
    { booking_id: bookingId, status: "pending", channel: "email" },
  );

  return makeEmailBookingSnapshot(booking);
}

function getEmailBookingById(bookingId) {
  return emailBookingsById.get(bookingId) || null;
}

function getEmailDebugState() {
  return { email_bookings: Array.from(emailBookingsById.values()).map(makeEmailBookingSnapshot) };
}

module.exports = { createEmailBooking, getEmailBookingById, getEmailDebugState };
