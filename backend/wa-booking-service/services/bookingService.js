const {
  parseAvailabilityReply,
  parseFreeOrPriceReply,
  parsePriceAndCurrency,
} = require("./parser");
const { sendWhatsAppMessage, sendWhatsAppTemplate, waTemplateLanguageCode } = require("./whatsapp");

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || "https://example.com/api/update-booking";
const APP_NOTIFY_RETRIES = Number.parseInt(process.env.APP_NOTIFY_RETRIES || "3", 10);
const APP_NOTIFY_TIMEOUT_MS = Number.parseInt(process.env.APP_NOTIFY_TIMEOUT_MS || "5000", 10);

const TEMPLATE_CHECK_IS_AVAILABLE = "check_is_available";
const TEMPLATE_FREE_OR_SET_PRICE = "chech_free_or_set_price";
const TEMPLATE_GOT_IT = "got_it";

const bookingsById = new Map();
const activeBookingIdsByPhone = new Map();
const outboundMessageToBookingId = new Map();
const processedInboundMessageIds = new Map();
const INBOUND_DEDUPE_TTL_MS = Number.parseInt(process.env.WA_INBOUND_DEDUPE_TTL_MS || String(60 * 60 * 1000), 10);

function log(action, details) {
  console.log(
    JSON.stringify({
      scope: "booking_service",
      action,
      ...details,
      timestamp: new Date().toISOString(),
    }),
  );
}

function cleanupProcessedInboundMessageIds(nowMs) {
  for (const [messageId, seenAtMs] of processedInboundMessageIds.entries()) {
    if (nowMs - seenAtMs > INBOUND_DEDUPE_TTL_MS) {
      processedInboundMessageIds.delete(messageId);
    }
  }
}

function markInboundMessageId(messageId) {
  const id = String(messageId || "").trim();
  if (!id) return { ok: true, duplicate: false };
  const nowMs = Date.now();
  cleanupProcessedInboundMessageIds(nowMs);
  if (processedInboundMessageIds.has(id)) {
    return { ok: true, duplicate: true };
  }
  processedInboundMessageIds.set(id, nowMs);
  return { ok: true, duplicate: false };
}

function sanitizePhone(phone) {
  return String(phone || "").trim();
}

function phoneLookupKey(phone) {
  return String(phone || "").replace(/\D+/g, "");
}

function optionalTrimString(payload, key) {
  const value = payload[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeInterfaceLocale(raw) {
  if (typeof raw !== "string") return "en";
  const base = raw.trim().split("-")[0]?.toLowerCase() ?? "";
  return base === "ru" ? "ru" : "en";
}

function resolveWaTemplate(baseName, locale) {
  const loc = locale === "ru" ? "ru" : "en";
  return `${baseName}_${loc}`;
}

function formatWaBookingDate(isoDate, locale) {
  const raw = String(isoDate || "").trim();
  if (!raw || raw === "—") return raw;
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  if (locale === "ru") {
    return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusLinesFor(locale, key) {
  const ru = {
    waiting_delivery: ["Шаблон принят WhatsApp API.", "Ожидаем ответ владельца…"],
    slot_declined: ["Владелец отклонил этот слот."],
    slot_available_pricing: ["Слот доступен.", "Уточняем стоимость…"],
    slot_free_confirm: ["Слот доступен и бесплатный.", "Можно подтвердить бронь в приложении."],
    slot_priced_confirm: ["Слот доступен.", "Цена получена — можно подтвердить в приложении."],
    awaiting_price: ["Слот доступен.", "Ожидаем цену от владельца…"],
    invalid_price: ["Слот доступен.", "Не удалось распознать цену — отправьте только сумму и валюту."],
  };
  const en = {
    waiting_delivery: ["Template accepted by WhatsApp API.", "Waiting for venue reply…"],
    slot_declined: ["Venue declined this slot."],
    slot_available_pricing: ["Slot available.", "Checking if booking is free…"],
    slot_free_confirm: ["Slot available and free.", "You can confirm the booking in the app."],
    slot_priced_confirm: ["Slot available.", "Price received — you can confirm in the app."],
    awaiting_price: ["Slot available.", "Awaiting price from venue…"],
    invalid_price: ["Slot available.", "Could not read price — send amount and currency only."],
  };
  const table = locale === "ru" ? ru : en;
  return table[key] ?? en[key] ?? [];
}

function repromptAvailability(locale) {
  return locale === "ru"
    ? "Пожалуйста, ответьте кнопкой: «Да, доступен» или «Нет, не доступен»."
    : "Please use the buttons: “Yes, available” or “No, not available”.";
}

function repromptPricing(locale) {
  return locale === "ru"
    ? "Пожалуйста, ответьте кнопкой: «Бесплатно» или «Назвать стоимость»."
    : "Please use the buttons: “It's free” or “Send the price”.";
}

function repromptPriceInput(locale) {
  return locale === "ru"
    ? "Укажите стоимость и валюту (например: 1500 ₽ или 25 USD)."
    : "Send the price and currency (e.g. 25 USD or 1500 RUB).";
}

function addActiveBooking(phone, bookingId) {
  const normalizedPhone = phoneLookupKey(phone);
  const existing = activeBookingIdsByPhone.get(normalizedPhone) || [];
  const updated = existing.filter((id) => id !== bookingId);
  updated.push(bookingId);
  activeBookingIdsByPhone.set(normalizedPhone, updated);
}

function removeActiveBooking(phone, bookingId) {
  const normalizedPhone = phoneLookupKey(phone);
  const existing = activeBookingIdsByPhone.get(normalizedPhone) || [];
  const updated = existing.filter((id) => id !== bookingId);
  if (updated.length === 0) {
    activeBookingIdsByPhone.delete(normalizedPhone);
    return;
  }
  activeBookingIdsByPhone.set(normalizedPhone, updated);
}

function getLatestActiveBookingByPhone(phone) {
  const normalizedPhone = phoneLookupKey(phone);
  const ids = activeBookingIdsByPhone.get(normalizedPhone) || [];
  for (let idx = ids.length - 1; idx >= 0; idx -= 1) {
    const booking = bookingsById.get(ids[idx]);
    if (booking && booking.step !== "completed") {
      return booking;
    }
  }
  return null;
}

function trackOutboundMessage(booking, messageId) {
  const id = String(messageId || "").trim();
  if (!id) return;
  outboundMessageToBookingId.set(id, booking.id);
}

function deliveryStatusLine(status, details, locale) {
  const s = String(status || "").toLowerCase();
  const ru = locale === "ru";
  if (s === "sent") return ru ? "Сообщение WhatsApp отправлено владельцу." : "WhatsApp message sent to venue.";
  if (s === "delivered") return ru ? "Сообщение WhatsApp доставлено владельцу." : "WhatsApp message delivered to venue.";
  if (s === "read") return ru ? "Владелец прочитал сообщение WhatsApp." : "Venue read the WhatsApp message.";
  if (s === "failed") {
    const prefix = ru ? "Ошибка доставки WhatsApp" : "WhatsApp delivery failed";
    return details ? `${prefix}: ${details}` : prefix;
  }
  return ru ? `Статус WhatsApp: ${status}` : `WhatsApp status: ${status}`;
}

function makeBookingSnapshot(booking) {
  return {
    id: booking.id,
    user_id: booking.user_id,
    venue_id: booking.venue_id,
    owner_phone: booking.owner_phone,
    status: booking.status,
    step: booking.step,
    interface_locale: booking.interface_locale,
    is_free: booking.is_free,
    price: booking.price,
    payment_link: booking.payment_link,
  };
}

function requireStringField(payload, fieldName) {
  const value = payload[fieldName];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid or missing field: ${fieldName}`);
  }
  return value.trim();
}

function hasSupabaseCartIntegration(booking) {
  return Boolean(
    booking.supabase_callback_url &&
      booking.supabase_callback_token &&
      typeof booking.supabase_callback_url === "string",
  );
}

async function postSupabaseCartCallback(booking, patch) {
  const url = String(booking.supabase_callback_url).trim();
  const token = String(booking.supabase_callback_token).trim();
  const secret = (process.env.WA_BOOKING_SUPABASE_CALLBACK_SECRET || "").trim();

  const isHostedSupabaseFn = /supabase\.co\/functions\/v1\//i.test(url);
  const gatewayJwt = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (isHostedSupabaseFn && !gatewayJwt) {
    log("supabase_cart_callback_missing_gateway_jwt", {
      booking_id: booking.id,
      hint: "Set SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY (same anon JWT). Without it, no request is sent — zero n8n-wa-booking-callback invocations in Supabase logs.",
    });
    console.error(
      "[wa-booking-service] Missing SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY: cannot POST to Supabase Edge callback (see README).",
    );
    return {
      ok: false,
      error: "Missing SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY for hosted Supabase Edge callback",
    };
  }

  const body = {
    callback_token: token,
    status_lines: patch.status_lines,
    confirmable: Boolean(patch.confirmable),
  };
  if (patch.confirmed_slot !== undefined) body.confirmed_slot = patch.confirmed_slot;
  if (patch.confirmed_price !== undefined && patch.confirmed_price !== null) {
    body.confirmed_price = String(patch.confirmed_price);
  }
  if (patch.payment_link != null) {
    const link = String(patch.payment_link).trim();
    if (link) body.payment_link = link;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= APP_NOTIFY_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_NOTIFY_TIMEOUT_MS);
    try {
      const headers = { "Content-Type": "application/json" };
      if (gatewayJwt && isHostedSupabaseFn) {
        headers.apikey = gatewayJwt;
        headers.Authorization = `Bearer ${gatewayJwt}`;
      }
      if (secret) {
        headers["x-wa-booking-secret"] = secret;
      }
      if (attempt === 1) {
        log("supabase_cart_callback_fetch", {
          booking_id: booking.id,
          has_gateway_jwt: Boolean(gatewayJwt),
          has_x_wa_secret: Boolean(secret),
        });
      }
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        log("supabase_cart_callback_ok", { booking_id: booking.id, attempt });
        return { ok: true };
      }
      const text = await response.text();
      lastError = new Error(`status=${response.status} body=${text.slice(0, 300)}`);
      log("supabase_cart_callback_non_2xx", { booking_id: booking.id, attempt, status: response.status });
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      log("supabase_cart_callback_error", { booking_id: booking.id, attempt, error: String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  return { ok: false, error: lastError ? String(lastError) : "Unknown Supabase callback error" };
}

async function notifyLegacyApp(payload) {
  let lastError = null;

  for (let attempt = 1; attempt <= APP_NOTIFY_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_NOTIFY_TIMEOUT_MS);

    try {
      const response = await fetch(APP_CALLBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        log("notify_legacy_app_ok", { payload, attempt });
        return { ok: true };
      }

      const body = await response.text();
      lastError = new Error(`status=${response.status} body=${body.slice(0, 300)}`);
      log("notify_legacy_app_non_2xx", { payload, attempt, status: response.status });
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      log("notify_legacy_app_error", { payload, attempt, error: String(error) });
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }

  return { ok: false, error: lastError ? String(lastError) : "Unknown notify error" };
}

async function syncCartOrLegacy(booking, supabasePatch, legacyPayload) {
  if (hasSupabaseCartIntegration(booking)) {
    log("sync_cart_notify_path", { booking_id: booking.id, path: "supabase_callback" });
    const out = await postSupabaseCartCallback(booking, supabasePatch);
    if (!out.ok) {
      log("supabase_cart_callback_exhausted", { booking_id: booking.id, error: out.error });
    }
    return out;
  }
  log("sync_cart_notify_path", {
    booking_id: booking.id,
    path: "legacy_app_callback",
    hint: "Payload had no supabase_callback_url/token — n8n-wa-booking-callback is never called.",
  });
  return notifyLegacyApp(legacyPayload);
}

async function sendLocaleTemplate(booking, baseName, variables = []) {
  const templateId = resolveWaTemplate(baseName, booking.interface_locale);
  const languageCode = waTemplateLanguageCode(booking.interface_locale);
  return sendWhatsAppTemplate(booking.owner_phone, templateId, variables, languageCode);
}

async function completeBookingWithTerms(booking, { isFree, priceDisplay }) {
  booking.is_free = Boolean(isFree);
  booking.price = isFree ? 0 : priceDisplay ?? null;
  booking.payment_link = null;
  booking.status = isFree ? "confirmed_free" : "confirmed_priced";
  booking.step = "completed";
  booking.updated_at = new Date().toISOString();
  removeActiveBooking(booking.owner_phone, booking.id);

  const locale = booking.interface_locale;

  const sendResult = await sendLocaleTemplate(booking, TEMPLATE_GOT_IT, []);
  trackOutboundMessage(booking, sendResult?.message_id);

  await syncCartOrLegacy(
    booking,
    {
      status_lines: isFree ? statusLinesFor(locale, "slot_free_confirm") : statusLinesFor(locale, "slot_priced_confirm"),
      confirmable: true,
      confirmed_price: isFree ? "0" : priceDisplay,
      payment_link: null,
    },
    {
      booking_id: booking.id,
      status: booking.status,
      step: booking.step,
      price: booking.price,
    },
  );
}

async function createBooking(payload) {
  const bookingId = requireStringField(payload, "booking_id");
  const venueName = requireStringField(payload, "venue_name");
  const date = requireStringField(payload, "date");
  const time = requireStringField(payload, "time");
  const ownerPhone = sanitizePhone(requireStringField(payload, "owner_phone"));
  const interfaceLocale = normalizeInterfaceLocale(payload.interface_locale);

  if (bookingsById.has(bookingId)) {
    const existing = bookingsById.get(bookingId);
    log("booking_already_exists", {
      booking_id: bookingId,
      hint: "In-memory duplicate: no new WhatsApp send and no Supabase callback. Use a new booking_id or restart the service for a full retest.",
    });
    return makeBookingSnapshot(existing);
  }

  const booking = {
    id: bookingId,
    user_id: payload.user_id || null,
    venue_id: payload.venue_id || null,
    owner_phone: ownerPhone,
    venue_name: venueName,
    customer_name: optionalTrimString(payload, "customer_name"),
    customer_phone: optionalTrimString(payload, "customer_phone"),
    date,
    time,
    interface_locale: interfaceLocale,
    status: "pending",
    step: "availability",
    is_free: null,
    price: null,
    payment_link: null,
    supabase_callback_url: optionalTrimString(payload, "supabase_callback_url"),
    supabase_callback_token: optionalTrimString(payload, "supabase_callback_token"),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  bookingsById.set(bookingId, booking);
  addActiveBooking(ownerPhone, bookingId);

  const displayDate = formatWaBookingDate(date, interfaceLocale);

  log("booking_created", {
    booking_id: bookingId,
    owner_phone: ownerPhone,
    step: booking.step,
    interface_locale: interfaceLocale,
  });

  const sendResult = await sendLocaleTemplate(booking, TEMPLATE_CHECK_IS_AVAILABLE, [
    booking.customer_name ?? "Client",
    booking.customer_phone ?? "—",
    venueName,
    displayDate,
    time,
  ]);
  trackOutboundMessage(booking, sendResult?.message_id);

  await syncCartOrLegacy(
    booking,
    {
      status_lines: statusLinesFor(interfaceLocale, "waiting_delivery"),
      confirmable: false,
      payment_link: null,
    },
    { booking_id: booking.id, status: booking.status, step: booking.step, price: null },
  );

  return makeBookingSnapshot(booking);
}

async function handleAvailabilityStep(booking, messageText) {
  const locale = booking.interface_locale;
  const decision = parseAvailabilityReply(messageText);

  if (decision === "no") {
    booking.status = "rejected";
    booking.step = "completed";
    booking.updated_at = new Date().toISOString();
    removeActiveBooking(booking.owner_phone, booking.id);

    const declineMsg =
      locale === "ru" ? "Слот недоступен. Диалог завершён." : "Slot not available. Flow closed.";
    const sendResult = await sendWhatsAppMessage(booking.owner_phone, declineMsg);
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      { status_lines: statusLinesFor(locale, "slot_declined"), confirmable: false, payment_link: null },
      { booking_id: booking.id, status: "rejected", step: booking.step },
    );
    return;
  }

  if (decision === "yes") {
    const sendResult = await sendLocaleTemplate(booking, TEMPLATE_FREE_OR_SET_PRICE, []);
    trackOutboundMessage(booking, sendResult?.message_id);
    booking.status = "available";
    booking.step = "pricing";
    booking.updated_at = new Date().toISOString();
    await syncCartOrLegacy(
      booking,
      {
        status_lines: statusLinesFor(locale, "slot_available_pricing"),
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptAvailability(locale));
  trackOutboundMessage(booking, sendResult?.message_id);
}

async function handlePricingStep(booking, messageText) {
  const locale = booking.interface_locale;
  const decision = parseFreeOrPriceReply(messageText);

  if (decision === "free") {
    await completeBookingWithTerms(booking, { isFree: true, priceDisplay: null });
    return;
  }

  if (decision === "send_price") {
    booking.is_free = false;
    booking.status = "price_requested";
    booking.step = "pricing_price_input";
    booking.updated_at = new Date().toISOString();
    const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptPriceInput(locale));
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: statusLinesFor(locale, "awaiting_price"),
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptPricing(locale));
  trackOutboundMessage(booking, sendResult?.message_id);
}

async function handlePricingPriceInputStep(booking, messageText) {
  const locale = booking.interface_locale;
  const parsed = parsePriceAndCurrency(messageText);

  if (parsed == null) {
    const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptPriceInput(locale));
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: statusLinesFor(locale, "invalid_price"),
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  await completeBookingWithTerms(booking, { isFree: false, priceDisplay: parsed.display });
}

async function processIncomingWhatsApp(payload) {
  const from = sanitizePhone(requireStringField(payload, "from"));
  const message = requireStringField(payload, "message");
  const inboundMessageId = String(payload?.message_id || "").trim();

  const dedupe = markInboundMessageId(inboundMessageId);
  if (dedupe.duplicate) {
    log("incoming_message_duplicate_ignored", { from, message_id: inboundMessageId, message });
    return {
      ok: true,
      ignored: true,
      reason: "Duplicate inbound message id",
      message_id: inboundMessageId,
    };
  }

  const booking = getLatestActiveBookingByPhone(from);
  if (!booking) {
    log("no_active_booking_for_phone", {
      from,
      from_lookup_key: phoneLookupKey(from),
      message,
      active_lookup_keys: Array.from(activeBookingIdsByPhone.keys()),
    });
    return {
      ok: true,
      ignored: true,
      reason: "No active booking for this phone",
    };
  }

  log("incoming_message", {
    booking_id: booking.id,
    from,
    message_id: inboundMessageId || null,
    step: booking.step,
    status: booking.status,
    message,
  });

  if (booking.step === "availability") {
    await handleAvailabilityStep(booking, message);
  } else if (booking.step === "pricing") {
    await handlePricingStep(booking, message);
  } else if (booking.step === "pricing_price_input") {
    await handlePricingPriceInputStep(booking, message);
  } else {
    log("message_for_completed_booking", { booking_id: booking.id, from });
    return { ok: true, ignored: true, reason: "Booking already completed" };
  }

  return {
    ok: true,
    booking: makeBookingSnapshot(booking),
  };
}

async function processDeliveryStatus(payload) {
  const messageId = String(payload?.id || "").trim();
  const status = String(payload?.status || "").trim();
  if (!messageId || !status) {
    return { ok: true, ignored: true, reason: "Missing message id or status" };
  }
  const bookingId = outboundMessageToBookingId.get(messageId);
  if (!bookingId) {
    log("delivery_status_unmatched", { message_id: messageId, status });
    return { ok: true, ignored: true, reason: "Unknown outbound message id", message_id: messageId };
  }
  const booking = bookingsById.get(bookingId);
  if (!booking) {
    log("delivery_status_orphan_booking", { booking_id: bookingId, message_id: messageId, status });
    return { ok: true, ignored: true, reason: "Booking not in memory", booking_id: bookingId };
  }

  const errorDetails = Array.isArray(payload?.errors)
    ? payload.errors
        .map((e) => String(e?.title || e?.message || e?.error_data?.details || "").trim())
        .filter(Boolean)
        .join("; ")
    : "";

  const line = deliveryStatusLine(status, errorDetails, booking.interface_locale);
  booking.updated_at = new Date().toISOString();
  log("delivery_status_ingested", { booking_id: booking.id, message_id: messageId, status, error_details: errorDetails || null });

  const isConfirmable =
    booking.status === "confirmed_free" || booking.status === "confirmed_priced";

  await syncCartOrLegacy(
    booking,
    {
      status_lines: [line],
      confirmable: isConfirmable,
      confirmed_price: booking.status === "confirmed_free" ? "0" : booking.price ?? undefined,
      payment_link: null,
    },
    { booking_id: booking.id, status: booking.status, step: booking.step, delivery_status: status },
  );

  return { ok: true, delivery_status: status, booking_id: booking.id };
}

function extractInboundText(message) {
  if (!message || typeof message !== "object") return null;
  if (typeof message.text?.body === "string" && message.text.body.trim()) return message.text.body.trim();
  if (typeof message.button?.text === "string" && message.button.text.trim()) return message.button.text.trim();
  if (typeof message.button?.payload === "string" && message.button.payload.trim()) return message.button.payload.trim();
  if (typeof message.interactive?.button_reply?.title === "string" && message.interactive.button_reply.title.trim()) {
    return message.interactive.button_reply.title.trim();
  }
  if (typeof message.interactive?.button_reply?.id === "string" && message.interactive.button_reply.id.trim()) {
    return message.interactive.button_reply.id.trim();
  }
  if (typeof message.interactive?.list_reply?.title === "string" && message.interactive.list_reply.title.trim()) {
    return message.interactive.list_reply.title.trim();
  }
  if (typeof message.interactive?.list_reply?.id === "string" && message.interactive.list_reply.id.trim()) {
    return message.interactive.list_reply.id.trim();
  }
  return null;
}

async function processWhatsAppWebhook(payload) {
  const statuses = [];
  const inbound = [];

  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value ?? {};
      if (Array.isArray(value.statuses)) {
        statuses.push(...value.statuses);
      }
      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          const text = extractInboundText(message);
          const from = String(message?.from || "").trim();
          const messageId = String(message?.id || "").trim();
          if (from && text) inbound.push({ from, message: text, message_id: messageId });
        }
      }
    }
  }

  const results = [];
  for (const msg of inbound) {
    results.push(await processIncomingWhatsApp(msg));
  }
  for (const st of statuses) {
    results.push(await processDeliveryStatus(st));
  }

  return {
    ok: true,
    ingested: {
      statuses: statuses.length,
      inbound_messages: inbound.length,
    },
    results,
  };
}

function getDebugState() {
  const bookings = Array.from(bookingsById.values()).map(makeBookingSnapshot);
  return {
    bookings,
    activeBookingIdsByPhone: Object.fromEntries(activeBookingIdsByPhone.entries()),
    outboundMessageToBookingId: Object.fromEntries(outboundMessageToBookingId.entries()),
  };
}

function getRuntimeTemplateConfig() {
  return {
    check_is_available: TEMPLATE_CHECK_IS_AVAILABLE,
    free_or_set_price: TEMPLATE_FREE_OR_SET_PRICE,
    got_it: TEMPLATE_GOT_IT,
  };
}

module.exports = {
  createBooking,
  processIncomingWhatsApp,
  processWhatsAppWebhook,
  getDebugState,
  getRuntimeTemplateConfig,
  resolveWaTemplate,
  normalizeInterfaceLocale,
  notifyApp: notifyLegacyApp,
};
