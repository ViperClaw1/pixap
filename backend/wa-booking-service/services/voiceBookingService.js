const { syncCartOrLegacy } = require("./bookingNotify");

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

/** In-memory store — mirrors pattern from bookingService.js. */
const voiceBookingsById = new Map();

function log(action, details) {
  console.log(
    JSON.stringify({
      scope: "voice_booking_service",
      action,
      ...details,
      timestamp: new Date().toISOString(),
    }),
  );
}

/** disconnection_reason values that mean a human never picked up. */
const NON_HUMAN_DISCONNECTION_REASONS = new Set(["no_answer", "voicemail_reached", "ivr_reached"]);

function mapDisconnectionToStatus(reason) {
  if (reason === "voicemail_reached") return "voice_voicemail";
  if (reason === "ivr_reached") return "voice_ivr_unresolved";
  return "voice_no_answer";
}

function mapDisconnectionToStatusLinesKey(reason) {
  if (reason === "voicemail_reached") return "voicemail";
  if (reason === "ivr_reached") return "ivr_unresolved";
  return "fallback_sms";
}

function voiceStatusLines(appLocale, key) {
  const lines = {
    en: {
      calling: ["Calling the venue to check availability…"],
      confirmed: ["Venue confirmed your booking by phone.", "You can confirm in the app."],
      declined: ["Venue declined your booking request."],
      alternative: ["Venue offered an alternative time.", "Please check your options in the app."],
      fallback_sms: ["No answer — sent a follow-up text to the venue. Waiting for reply…"],
      voicemail: ["Reached voicemail — sent a follow-up text to the venue. Waiting for reply…"],
      ivr_unresolved: ["Reached automated menu — sent a follow-up text to the venue. Waiting for reply…"],
    },
    ru: {
      calling: ["Звоним в заведение для уточнения доступности…"],
      confirmed: ["Заведение подтвердило бронь по телефону.", "Можно подтвердить в приложении."],
      declined: ["Заведение отклонило запрос на бронирование."],
      alternative: ["Заведение предложило альтернативное время.", "Проверьте варианты в приложении."],
      fallback_sms: ["Нет ответа — отправили текстовое сообщение в заведение. Ожидаем ответ…"],
      voicemail: ["Дозвонились до автоответчика — отправили SMS в заведение. Ожидаем ответ…"],
      ivr_unresolved: ["Попали на голосовое меню — отправили SMS в заведение. Ожидаем ответ…"],
    },
  };
  const table = appLocale === "ru" ? lines.ru : lines.en;
  return table[key] ?? lines.en[key] ?? [];
}

function makeVoiceBookingSnapshot(booking) {
  return {
    id: booking.id,
    channel: "voice",
    status: booking.status,
    owner_phone: booking.owner_phone,
    retell_call_id: booking.retell_call_id ?? null,
  };
}

async function initiateVoiceBooking(payload) {
  const {
    booking_id,
    venue_name,
    date,
    time,
    owner_phone,
    customer_name,
    app_interface_locale,
    supabase_callback_url,
    supabase_callback_token,
  } = payload;

  const appLocale = app_interface_locale === "ru" ? "ru" : "en";

  if (voiceBookingsById.has(booking_id)) {
    log("voice_booking_already_exists", { booking_id });
    return makeVoiceBookingSnapshot(voiceBookingsById.get(booking_id));
  }

  const booking = {
    id: booking_id,
    channel: "voice",
    venue_name,
    date,
    time,
    owner_phone,
    customer_name: customer_name || null,
    app_interface_locale: appLocale,
    supabase_callback_url: supabase_callback_url || null,
    supabase_callback_token: supabase_callback_token || null,
    status: "calling",
    retell_call_id: null,
    created_at: new Date().toISOString(),
  };

  voiceBookingsById.set(booking_id, booking);

  log("voice_booking_created", { booking_id, owner_phone });

  if (!RETELL_API_KEY || !RETELL_AGENT_ID || !RETELL_FROM_NUMBER) {
    log("voice_booking_retell_not_configured", {
      booking_id,
      hint: "Set RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER on Railway.",
    });
    await syncCartOrLegacy(
      booking,
      { status_lines: ["Voice booking not configured — contact support."], confirmable: false },
      { booking_id, status: "error", channel: "voice" },
    );
    return makeVoiceBookingSnapshot(booking);
  }

  let callId = null;
  try {
    const response = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_number: RETELL_FROM_NUMBER,
        to_number: owner_phone,
        override_agent_id: RETELL_AGENT_ID,
        retell_llm_dynamic_variables: {
          venue_name,
          date,
          time,
          customer_name: customer_name || "a Pixap guest",
          booking_id,
        },
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Retell API ${response.status}: ${text.slice(0, 300)}`);
    }
    const data = await response.json();
    callId = data.call_id ?? null;
    booking.retell_call_id = callId;
    log("retell_call_created", { booking_id, call_id: callId });
  } catch (err) {
    log("retell_call_error", { booking_id, error: String(err) });
    booking.status = "call_error";
    await syncCartOrLegacy(
      booking,
      { status_lines: ["Could not initiate call — contact support."], confirmable: false },
      { booking_id, status: "call_error", channel: "voice" },
    );
    return makeVoiceBookingSnapshot(booking);
  }

  await syncCartOrLegacy(
    booking,
    { status_lines: voiceStatusLines(appLocale, "calling"), confirmable: false },
    { booking_id, status: "calling", channel: "voice" },
  );

  return makeVoiceBookingSnapshot(booking);
}

async function handleRetellWebhook(payload) {
  const bookingId = payload?.call?.retell_llm_dynamic_variables?.booking_id;
  if (!bookingId) {
    log("retell_webhook_no_booking_id", { payload_keys: Object.keys(payload || {}) });
    return;
  }

  const booking = voiceBookingsById.get(bookingId);
  if (!booking) {
    log("retell_webhook_unknown_booking", { booking_id: bookingId });
    return;
  }

  const outcome = payload?.call?.call_analysis?.custom_analysis_data?.outcome;
  const disconnectionReason = payload?.call?.disconnection_reason;
  const noAnswer = NON_HUMAN_DISCONNECTION_REASONS.has(disconnectionReason);

  log("retell_webhook_received", {
    booking_id: bookingId,
    outcome,
    no_answer: noAnswer,
    disconnection_reason: disconnectionReason,
  });

  if (outcome === "UNCLEAR" || noAnswer) {
    const fallbackStatus = mapDisconnectionToStatus(disconnectionReason);
    const statusLinesKey = mapDisconnectionToStatusLinesKey(disconnectionReason);
    booking.status = fallbackStatus;
    const appLocale = booking.app_interface_locale;
    await syncCartOrLegacy(
      booking,
      { status_lines: voiceStatusLines(appLocale, statusLinesKey), confirmable: false },
      { booking_id: bookingId, status: fallbackStatus, channel: "voice" },
    );
    const { createSmsBooking } = require("./smsBookingService");
    await createSmsBooking({ ...booking, fallback_from: "voice" });
    return;
  }

  const appLocale = booking.app_interface_locale;

  if (outcome === "IVR_NAVIGATION_FAILED") {
    booking.status = "voice_ivr_failed";
    await syncCartOrLegacy(
      booking,
      { status_lines: voiceStatusLines(appLocale, "ivr_unresolved"), confirmable: false },
      { booking_id: bookingId, status: "voice_ivr_failed", channel: "voice" },
    );
    const { createSmsBooking } = require("./smsBookingService");
    await createSmsBooking({ ...booking, fallback_from: "voice" });
    return;
  }

  if (outcome === "CONFIRMED") {
    booking.status = "voice_confirmed";
    voiceBookingsById.delete(bookingId);
    await syncCartOrLegacy(
      booking,
      { status_lines: voiceStatusLines(appLocale, "confirmed"), confirmable: true },
      { booking_id: bookingId, status: "voice_confirmed", channel: "voice" },
    );
    return;
  }

  if (outcome === "DECLINED") {
    booking.status = "voice_declined";
    voiceBookingsById.delete(bookingId);
    await syncCartOrLegacy(
      booking,
      { status_lines: voiceStatusLines(appLocale, "declined"), confirmable: false },
      { booking_id: bookingId, status: "voice_declined", channel: "voice" },
    );
    return;
  }

  if (outcome === "ALTERNATIVE_OFFERED") {
    booking.status = "voice_alternative";
    voiceBookingsById.delete(bookingId);
    await syncCartOrLegacy(
      booking,
      { status_lines: voiceStatusLines(appLocale, "alternative"), confirmable: false },
      { booking_id: bookingId, status: "voice_alternative", channel: "voice" },
    );
    return;
  }

  // Unknown outcome — treat as UNCLEAR and fall back to SMS
  log("retell_webhook_unknown_outcome", { booking_id: bookingId, outcome });
  booking.status = "voice_unclear";
  await syncCartOrLegacy(
    booking,
    { status_lines: voiceStatusLines(appLocale, "fallback_sms"), confirmable: false },
    { booking_id: bookingId, status: "voice_unclear", channel: "voice" },
  );
  const { createSmsBooking } = require("./smsBookingService");
  await createSmsBooking({ ...booking, fallback_from: "voice" });
}

function getVoiceDebugState() {
  return { voice_bookings: Array.from(voiceBookingsById.values()).map(makeVoiceBookingSnapshot) };
}

module.exports = { initiateVoiceBooking, handleRetellWebhook, getVoiceDebugState };
