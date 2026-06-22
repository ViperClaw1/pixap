const { syncCartOrLegacy } = require("./bookingNotify");
const { parseAvailabilityReply, parseFreeOrPriceReply, parsePriceAndCurrency } = require("./parser");

const smsBookingsById = new Map();
/** phone (digits-only) → booking_id */
const activeSmsBookingByPhone = new Map();

function log(action, details) {
  console.log(
    JSON.stringify({
      scope: "sms_booking_service",
      action,
      ...details,
      timestamp: new Date().toISOString(),
    }),
  );
}

function phoneKey(phone) {
  return String(phone || "").replace(/\D+/g, "");
}

function smsStatusLines(appLocale, key) {
  const lines = {
    en: {
      sent: ["Text message sent to venue. Waiting for reply…"],
      available_pricing: ["Venue available via SMS. Checking booking fee…"],
      slot_free_confirm: ["Slot available and free.", "You can confirm the booking in the app."],
      slot_priced_confirm: ["Slot available.", "Price received — you can confirm in the app."],
      awaiting_price: ["Slot available.", "Awaiting price from venue…"],
      declined: ["Venue declined your booking request by text."],
      invalid_price: ["Slot available.", "Could not read price — venue should send amount and currency only."],
    },
    ru: {
      sent: ["SMS отправлен в заведение. Ожидаем ответ…"],
      available_pricing: ["Слот доступен (по SMS). Уточняем стоимость…"],
      slot_free_confirm: ["Слот доступен и бесплатный.", "Можно подтвердить бронь в приложении."],
      slot_priced_confirm: ["Слот доступен.", "Цена получена — можно подтвердить в приложении."],
      awaiting_price: ["Слот доступен.", "Ожидаем цену от заведения…"],
      declined: ["Заведение отклонило запрос на бронирование по SMS."],
      invalid_price: ["Слот доступен.", "Не удалось распознать цену — заведение должно отправить только сумму и валюту."],
    },
  };
  const table = appLocale === "ru" ? lines.ru : lines.en;
  return table[key] ?? lines.en[key] ?? [];
}

function buildAvailabilityMessage(booking) {
  const { venue_name, customer_name, date, time } = booking;
  const guest = customer_name || "a guest";
  return (
    `Hi! ${guest} would like to book a table at ${venue_name} on ${date} at ${time}. ` +
    `Is this slot available? Reply YES or NO.\n\n` +
    `[Pixap booking — ref: ${booking.id}]`
  );
}

function buildPricingMessage() {
  return "Great! Is there a booking fee? Reply FREE or PRICE.";
}

function buildPricePromptMessage() {
  return "Please send the price and currency (e.g. 25 USD or 1500 RUB).";
}

function buildConfirmMessage() {
  return "Booking confirmed! Thank you.";
}

function buildDeclineMessage() {
  return "Slot not available — noted. Thank you.";
}

function makeSmsBookingSnapshot(booking) {
  return {
    id: booking.id,
    channel: "sms",
    step: booking.step,
    status: booking.status,
    owner_phone: booking.owner_phone,
  };
}

async function sendSms(toPhone, text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SMS_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    log("sms_not_configured", { to: toPhone, hint: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM_NUMBER" });
    return null;
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({
    From: fromNumber,
    To: toPhone,
    Body: text,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  return { message_id: data.sid };
}

async function createSmsBooking(payload) {
  const {
    id: bookingId,
    venue_name,
    date,
    time,
    owner_phone,
    customer_name,
    app_interface_locale,
    supabase_callback_url,
    supabase_callback_token,
    fallback_from,
  } = payload;

  if (smsBookingsById.has(bookingId)) {
    log("sms_booking_already_exists", { booking_id: bookingId });
    return makeSmsBookingSnapshot(smsBookingsById.get(bookingId));
  }

  const appLocale = app_interface_locale === "ru" ? "ru" : "en";

  const booking = {
    id: bookingId,
    channel: "sms",
    venue_name,
    date,
    time,
    owner_phone,
    customer_name: customer_name || null,
    app_interface_locale: appLocale,
    supabase_callback_url: supabase_callback_url || null,
    supabase_callback_token: supabase_callback_token || null,
    step: "availability",
    status: "pending",
    is_free: null,
    price: null,
    fallback_from: fallback_from || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  smsBookingsById.set(bookingId, booking);
  activeSmsBookingByPhone.set(phoneKey(owner_phone), bookingId);

  log("sms_booking_created", { booking_id: bookingId, owner_phone, fallback_from });

  try {
    await sendSms(owner_phone, buildAvailabilityMessage(booking));
  } catch (err) {
    log("sms_send_error", { booking_id: bookingId, error: String(err) });
  }

  await syncCartOrLegacy(
    booking,
    { status_lines: smsStatusLines(appLocale, "sent"), confirmable: false },
    { booking_id: bookingId, status: "pending", channel: "sms" },
  );

  return makeSmsBookingSnapshot(booking);
}

async function processIncomingSms({ from, message, message_id }) {
  const key = phoneKey(from);
  const bookingId = activeSmsBookingByPhone.get(key);
  if (!bookingId) {
    log("sms_no_active_booking", { from, message_id });
    return { ok: true, ignored: true, reason: "No active SMS booking for this phone" };
  }

  const booking = smsBookingsById.get(bookingId);
  if (!booking) {
    log("sms_booking_not_in_memory", { booking_id: bookingId, from });
    return { ok: true, ignored: true, reason: "SMS booking not in memory" };
  }

  log("sms_incoming", { booking_id: bookingId, from, step: booking.step, message_id, message });

  const appLocale = booking.app_interface_locale;

  if (booking.step === "availability") {
    const decision = parseAvailabilityReply(message);
    if (decision === "no") {
      booking.status = "rejected";
      booking.step = "completed";
      booking.updated_at = new Date().toISOString();
      activeSmsBookingByPhone.delete(key);
      try { await sendSms(booking.owner_phone, buildDeclineMessage()); } catch (_) {}
      await syncCartOrLegacy(
        booking,
        { status_lines: smsStatusLines(appLocale, "declined"), confirmable: false },
        { booking_id: bookingId, status: "rejected", channel: "sms" },
      );
      return { ok: true, booking: makeSmsBookingSnapshot(booking) };
    }
    if (decision === "yes") {
      booking.step = "pricing";
      booking.status = "available";
      booking.updated_at = new Date().toISOString();
      try { await sendSms(booking.owner_phone, buildPricingMessage()); } catch (_) {}
      await syncCartOrLegacy(
        booking,
        { status_lines: smsStatusLines(appLocale, "available_pricing"), confirmable: false },
        { booking_id: bookingId, status: "available", channel: "sms" },
      );
      return { ok: true, booking: makeSmsBookingSnapshot(booking) };
    }
    // unrecognized — re-prompt silently (no re-send to avoid SMS spam)
    return { ok: true, ignored: true, reason: "Unrecognized availability reply" };
  }

  if (booking.step === "pricing") {
    const decision = parseFreeOrPriceReply(message);
    if (decision === "free") {
      booking.is_free = true;
      booking.status = "confirmed_free";
      booking.step = "completed";
      booking.updated_at = new Date().toISOString();
      activeSmsBookingByPhone.delete(key);
      try { await sendSms(booking.owner_phone, buildConfirmMessage()); } catch (_) {}
      await syncCartOrLegacy(
        booking,
        { status_lines: smsStatusLines(appLocale, "slot_free_confirm"), confirmable: true, confirmed_price: "0" },
        { booking_id: bookingId, status: "confirmed_free", channel: "sms" },
      );
      return { ok: true, booking: makeSmsBookingSnapshot(booking) };
    }
    if (decision === "send_price") {
      booking.is_free = false;
      booking.step = "pricing_price_input";
      booking.status = "price_requested";
      booking.updated_at = new Date().toISOString();
      try { await sendSms(booking.owner_phone, buildPricePromptMessage()); } catch (_) {}
      await syncCartOrLegacy(
        booking,
        { status_lines: smsStatusLines(appLocale, "awaiting_price"), confirmable: false },
        { booking_id: bookingId, status: "price_requested", channel: "sms" },
      );
      return { ok: true, booking: makeSmsBookingSnapshot(booking) };
    }
    return { ok: true, ignored: true, reason: "Unrecognized pricing reply" };
  }

  if (booking.step === "pricing_price_input") {
    const parsed = parsePriceAndCurrency(message);
    if (!parsed) {
      await syncCartOrLegacy(
        booking,
        { status_lines: smsStatusLines(appLocale, "invalid_price"), confirmable: false },
        { booking_id: bookingId, status: booking.status, channel: "sms" },
      );
      return { ok: true, ignored: true, reason: "Could not parse price" };
    }
    booking.price = parsed.display;
    booking.is_free = false;
    booking.status = "confirmed_priced";
    booking.step = "completed";
    booking.updated_at = new Date().toISOString();
    activeSmsBookingByPhone.delete(key);
    try { await sendSms(booking.owner_phone, buildConfirmMessage()); } catch (_) {}
    await syncCartOrLegacy(
      booking,
      { status_lines: smsStatusLines(appLocale, "slot_priced_confirm"), confirmable: true, confirmed_price: parsed.display },
      { booking_id: bookingId, status: "confirmed_priced", channel: "sms" },
    );
    return { ok: true, booking: makeSmsBookingSnapshot(booking) };
  }

  return { ok: true, ignored: true, reason: "SMS booking already completed" };
}

function getSmsDebugState() {
  return { sms_bookings: Array.from(smsBookingsById.values()).map(makeSmsBookingSnapshot) };
}

module.exports = { createSmsBooking, processIncomingSms, getSmsDebugState };
