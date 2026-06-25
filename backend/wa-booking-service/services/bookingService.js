const {
  parseAvailabilityReply,
  parseFreeOrPriceReply,
  parsePriceAndCurrency,
} = require("./parser");
const {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  waTemplateLanguageCodeForTemplate,
} = require("./whatsapp");
const { waTemplateLocaleFromOwnerPhone } = require("./waTemplateLocale");
const { syncCartOrLegacy, notifyLegacyApp: notifyLegacyApp_ } = require("./bookingNotify");
const { bookingChannelFromOwnerPhone } = require("./bookingChannelRegion");

/** Base names in Meta; resolved per locale as `{base}_{rus|eng}` (see resolveWaTemplate). */
const TEMPLATE_CHECK_IS_AVAILABLE = "check_availability";
const TEMPLATE_FREE_OR_SET_PRICE = "check_price";
const TEMPLATE_GOT_IT = "confirm";

/** Ordered WhatsApp template flow per venue phone locale (`_rus` / `_eng`, see waTemplateLocaleFromOwnerPhone). */
const TEMPLATE_FLOW_BY_LOCALE = {
  ru: [
    `${TEMPLATE_CHECK_IS_AVAILABLE}_rus`,
    `${TEMPLATE_FREE_OR_SET_PRICE}_rus`,
    `${TEMPLATE_GOT_IT}_rus`,
  ],
  en: [
    `${TEMPLATE_CHECK_IS_AVAILABLE}_eng`,
    `${TEMPLATE_FREE_OR_SET_PRICE}_eng`,
    `${TEMPLATE_GOT_IT}_eng`,
  ],
};

const bookingsById = new Map();
const activeBookingIdsByPhone = new Map();
/** @type {Map<string, { bookingId: string, template_id?: string | null, header_image_url?: string | null }>} */
const outboundMessageMeta = new Map();
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
  const suffix = locale === "ru" ? "rus" : "eng";
  return `${baseName}_${suffix}`;
}

/** WhatsApp template chain locale from venue phone — never from app UI language. */
function bookingWaTemplateLocale(booking) {
  if (booking?.template_locale === "ru" || booking?.template_locale === "en") {
    return booking.template_locale;
  }
  return waTemplateLocaleFromOwnerPhone(booking?.owner_phone);
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

function trackOutboundMessage(booking, messageId, meta = {}) {
  const id = String(messageId || "").trim();
  if (!id) return;
  outboundMessageMeta.set(id, {
    bookingId: booking.id,
    template_id: meta.template_id ?? null,
    header_image_url: meta.header_image_url ?? null,
  });
}

function isWaMessageUndeliverable(details) {
  const d = String(details || "").toLowerCase();
  return (
    /undeliverable/i.test(d) ||
    /not a valid whatsapp/i.test(d) ||
    /not registered on whatsapp/i.test(d) ||
    /recipient.*not.*whatsapp/i.test(d) ||
    /invalid.*whatsapp.*user/i.test(d) ||
    /131026/.test(d)
  );
}

function bookingUserLocale(booking) {
  return booking?.app_interface_locale === "ru" ? "ru" : "en";
}

/** User-facing lines when venue WhatsApp number cannot receive messages. */
function waOwnerUnreachableStatusLines(locale, ownerPhone) {
  const ru = locale === "ru";
  const phoneHint = ownerPhone ? ` (${ownerPhone})` : "";
  if (ru) {
    return [
      "Не удалось связаться с заведением в WhatsApp.",
      `Номер${phoneHint} не зарегистрирован в WhatsApp или недоступен. Обновите contact_whatsapp в карточке заведения и попробуйте снова.`,
    ];
  }
  return [
    "Could not reach the venue on WhatsApp.",
    `The number${phoneHint} is not on WhatsApp or cannot receive messages. Update the venue contact_whatsapp and try again.`,
  ];
}

function deliveryStatusLine(status, details, locale) {
  const s = String(status || "").toLowerCase();
  const ru = locale === "ru";
  if (s === "sent") return ru ? "Сообщение WhatsApp отправлено владельцу." : "WhatsApp message sent to venue.";
  if (s === "delivered") return ru ? "Сообщение WhatsApp доставлено владельцу." : "WhatsApp message delivered to venue.";
  if (s === "read") return ru ? "Владелец прочитал сообщение WhatsApp." : "Venue read the WhatsApp message.";
  if (s === "failed") {
    if (isWaMessageUndeliverable(details)) {
      return waOwnerUnreachableStatusLines(locale, null)[0];
    }
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
    template_locale: booking.template_locale ?? booking.interface_locale,
    app_interface_locale: booking.app_interface_locale ?? null,
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

// syncCartOrLegacy, hasSupabaseCartIntegration, postSupabaseCartCallback, notifyLegacyApp
// are now provided by ./bookingNotify (imported above).

async function sendLocaleTemplate(booking, baseName, variables = []) {
  const waLocale = bookingWaTemplateLocale(booking);
  const templateId = resolveWaTemplate(baseName, waLocale);
  const languageCode = waTemplateLanguageCodeForTemplate(templateId);
  log("wa_template_send", {
    booking_id: booking.id,
    template_id: templateId,
    language_code: languageCode,
    wa_locale: waLocale,
    app_interface_locale: booking.app_interface_locale ?? null,
  });
  const result = await sendWhatsAppTemplate(booking.owner_phone, templateId, variables, languageCode);
  trackOutboundMessage(booking, result?.message_id, {
    template_id: templateId,
    header_image_url: result?.header_image_url ?? null,
  });
  return result;
}

async function completeBookingWithTerms(booking, { isFree, priceDisplay }) {
  booking.is_free = Boolean(isFree);
  booking.price = isFree ? 0 : priceDisplay ?? null;
  booking.payment_link = null;
  booking.status = isFree ? "confirmed_free" : "confirmed_priced";
  booking.step = "completed";
  booking.updated_at = new Date().toISOString();
  removeActiveBooking(booking.owner_phone, booking.id);

  const locale = bookingUserLocale(booking);

  await sendLocaleTemplate(booking, TEMPLATE_GOT_IT, []);

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

  const explicitChannel = optionalTrimString(payload, "preferred_booking_channel");
  const channel = explicitChannel ?? bookingChannelFromOwnerPhone(ownerPhone);

  if (channel === "voice") {
    const { initiateVoiceBooking } = require("./voiceBookingService");
    return initiateVoiceBooking({
      booking_id: bookingId,
      venue_name: venueName,
      date,
      time,
      owner_phone: ownerPhone,
      customer_name: optionalTrimString(payload, "customer_name"),
      app_interface_locale: optionalTrimString(payload, "interface_locale") ?? "en",
      supabase_callback_url: optionalTrimString(payload, "supabase_callback_url"),
      supabase_callback_token: optionalTrimString(payload, "supabase_callback_token"),
      external_booking_platform: optionalTrimString(payload, "external_booking_platform") || null,
      external_booking_url: optionalTrimString(payload, "external_booking_url") || null,
      contact_email: optionalTrimString(payload, "contact_email") || null,
    });
  }

  const templateLocale = waTemplateLocaleFromOwnerPhone(ownerPhone);

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
    template_locale: templateLocale,
    interface_locale: templateLocale,
    app_interface_locale: normalizeInterfaceLocale(optionalTrimString(payload, "interface_locale")),
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

  const displayDate = formatWaBookingDate(date, templateLocale);

  log("booking_created", {
    booking_id: bookingId,
    owner_phone: ownerPhone,
    step: booking.step,
    template_locale: templateLocale,
    app_interface_locale: booking.app_interface_locale,
  });

  await sendLocaleTemplate(booking, TEMPLATE_CHECK_IS_AVAILABLE, [
    booking.customer_name ?? "Client",
    booking.customer_phone ?? "—",
    venueName,
    displayDate,
    time,
  ]);

  await syncCartOrLegacy(
    booking,
    {
      status_lines: statusLinesFor(bookingUserLocale(booking), "waiting_delivery"),
      confirmable: false,
      payment_link: null,
    },
    { booking_id: booking.id, status: booking.status, step: booking.step, price: null },
  );

  return makeBookingSnapshot(booking);
}

async function handleAvailabilityStep(booking, messageText) {
  const waLocale = booking.interface_locale;
  const userLocale = bookingUserLocale(booking);
  const decision = parseAvailabilityReply(messageText);

  if (decision === "no") {
    booking.status = "rejected";
    booking.step = "completed";
    booking.updated_at = new Date().toISOString();
    removeActiveBooking(booking.owner_phone, booking.id);

    const declineMsg =
      waLocale === "ru" ? "Слот недоступен. Диалог завершён." : "Slot not available. Flow closed.";
    const sendResult = await sendWhatsAppMessage(booking.owner_phone, declineMsg);
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      { status_lines: statusLinesFor(userLocale, "slot_declined"), confirmable: false, payment_link: null },
      { booking_id: booking.id, status: "rejected", step: booking.step },
    );
    return;
  }

  if (decision === "yes") {
    await sendLocaleTemplate(booking, TEMPLATE_FREE_OR_SET_PRICE, []);
    booking.status = "available";
    booking.step = "pricing";
    booking.updated_at = new Date().toISOString();
    await syncCartOrLegacy(
      booking,
      {
        status_lines: statusLinesFor(userLocale, "slot_available_pricing"),
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptAvailability(waLocale));
  trackOutboundMessage(booking, sendResult?.message_id);
}

async function handlePricingStep(booking, messageText) {
  const waLocale = booking.interface_locale;
  const userLocale = bookingUserLocale(booking);
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
    const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptPriceInput(waLocale));
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: statusLinesFor(userLocale, "awaiting_price"),
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptPricing(waLocale));
  trackOutboundMessage(booking, sendResult?.message_id);
}

async function handlePricingPriceInputStep(booking, messageText) {
  const waLocale = booking.interface_locale;
  const userLocale = bookingUserLocale(booking);
  const parsed = parsePriceAndCurrency(messageText);

  if (parsed == null) {
    const sendResult = await sendWhatsAppMessage(booking.owner_phone, repromptPriceInput(waLocale));
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: statusLinesFor(userLocale, "invalid_price"),
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
  const meta = outboundMessageMeta.get(messageId);
  const bookingId = meta?.bookingId;
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

  const ownerUnreachable =
    String(status).toLowerCase() === "failed" && isWaMessageUndeliverable(errorDetails);
  const userLocale = bookingUserLocale(booking);
  const statusLines = ownerUnreachable
    ? waOwnerUnreachableStatusLines(userLocale, booking.owner_phone)
    : [deliveryStatusLine(status, errorDetails, userLocale)];

  if (ownerUnreachable) {
    booking.status = "wa_unreachable";
    booking.wa_owner_unreachable = true;
    removeActiveBooking(booking.owner_phone, booking.id);
  }

  booking.updated_at = new Date().toISOString();
  log("delivery_status_ingested", {
    booking_id: booking.id,
    message_id: messageId,
    status,
    template_id: meta?.template_id ?? null,
    header_image_url: meta?.header_image_url ?? null,
    error_details: errorDetails || null,
    owner_unreachable: ownerUnreachable,
    ...(status === "failed" && /media upload/i.test(errorDetails)
      ? {
          hint:
            "A WHATSAPP_*_HEADER_IMAGE_URL is set but Meta cannot fetch it. Remove those env vars if the template uses a static header in Meta; or fix the URL to a direct public HTTPS JPG/PNG.",
        }
      : {}),
    ...(ownerUnreachable
      ? {
          hint: "Venue WhatsApp number is not reachable (undeliverable). User notified via wa_status_lines.",
        }
      : {}),
  });

  const isConfirmable =
    !ownerUnreachable &&
    (booking.status === "confirmed_free" || booking.status === "confirmed_priced");

  await syncCartOrLegacy(
    booking,
    {
      status_lines: statusLines,
      confirmable: isConfirmable,
      confirmed_price: booking.status === "confirmed_free" ? "0" : booking.price ?? undefined,
      payment_link: null,
    },
    {
      booking_id: booking.id,
      status: booking.status,
      step: booking.step,
      delivery_status: status,
      wa_owner_unreachable: ownerUnreachable,
    },
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
  const { getVoiceDebugState } = require("./voiceBookingService");
  const { getSmsDebugState } = require("./smsBookingService");
  return {
    bookings,
    activeBookingIdsByPhone: Object.fromEntries(activeBookingIdsByPhone.entries()),
    outboundMessageMeta: Object.fromEntries(outboundMessageMeta.entries()),
    ...getVoiceDebugState(),
    ...getSmsDebugState(),
  };
}

function getRuntimeTemplateConfig() {
  const { waTemplateLanguageCodeForTemplate } = require("./whatsapp");
  const sequence_with_language = {};
  for (const [loc, ids] of Object.entries(TEMPLATE_FLOW_BY_LOCALE)) {
    sequence_with_language[loc] = ids.map((template_id) => ({
      template_id,
      language_code: waTemplateLanguageCodeForTemplate(template_id),
    }));
  }
  return {
    bases: {
      check_is_available: TEMPLATE_CHECK_IS_AVAILABLE,
      free_or_set_price: TEMPLATE_FREE_OR_SET_PRICE,
      got_it: TEMPLATE_GOT_IT,
    },
    sequence_by_locale: TEMPLATE_FLOW_BY_LOCALE,
    sequence_with_language,
    env: {
      WHATSAPP_TEMPLATE_LANGUAGE: (process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en").trim(),
      WHATSAPP_TEMPLATE_LANGUAGE_EN: (process.env.WHATSAPP_TEMPLATE_LANGUAGE_EN || "").trim() || null,
      WHATSAPP_TEMPLATE_LANGUAGE_RU: (process.env.WHATSAPP_TEMPLATE_LANGUAGE_RU || "").trim() || null,
    },
  };
}

function getResolvedTemplateSequence(localeOrPhone) {
  const raw = String(localeOrPhone || "").trim();
  const loc =
    raw.startsWith("+") || /^\d/.test(raw)
      ? waTemplateLocaleFromOwnerPhone(raw)
      : normalizeInterfaceLocale(raw);
  return TEMPLATE_FLOW_BY_LOCALE[loc] ?? TEMPLATE_FLOW_BY_LOCALE.en;
}

module.exports = {
  createBooking,
  processIncomingWhatsApp,
  processWhatsAppWebhook,
  getDebugState,
  getRuntimeTemplateConfig,
  getResolvedTemplateSequence,
  resolveWaTemplate,
  normalizeInterfaceLocale,
  waTemplateLocaleFromOwnerPhone,
  notifyApp: notifyLegacyApp_,
};
