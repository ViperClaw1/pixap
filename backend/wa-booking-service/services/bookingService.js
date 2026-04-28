const { parsePaymentLink, parseYesNo } = require("./parser");
const { sendWhatsAppMessage, sendWhatsAppTemplate } = require("./whatsapp");

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || "https://example.com/api/update-booking";
const APP_NOTIFY_RETRIES = Number.parseInt(process.env.APP_NOTIFY_RETRIES || "3", 10);
const APP_NOTIFY_TIMEOUT_MS = Number.parseInt(process.env.APP_NOTIFY_TIMEOUT_MS || "5000", 10);

const bookingsById = new Map();
const activeBookingIdsByPhone = new Map();
const outboundMessageToBookingId = new Map();

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

function deliveryStatusLine(status, details) {
  const s = String(status || "").toLowerCase();
  if (s === "sent") return "WhatsApp message sent to venue.";
  if (s === "delivered") return "WhatsApp message delivered to venue.";
  if (s === "read") return "Venue read the WhatsApp message.";
  if (s === "failed") return details ? `WhatsApp delivery failed: ${details}` : "WhatsApp delivery failed.";
  return `WhatsApp status: ${status}`;
}

function makeBookingSnapshot(booking) {
  return {
    id: booking.id,
    user_id: booking.user_id,
    venue_id: booking.venue_id,
    owner_phone: booking.owner_phone,
    status: booking.status,
    step: booking.step,
    is_free: booking.is_free,
    price: booking.price,
    payment_link: booking.payment_link,
  };
}

function normalizeDecisionInput(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/[_-]+/g, " ");
}

function parseOwnerYesNo(text) {
  const normalized = normalizeDecisionInput(text);
  if (!normalized) return null;
  return parseYesNo(normalized);
}

function requireStringField(payload, fieldName) {
  const value = payload[fieldName];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid or missing field: ${fieldName}`);
  }
  return value.trim();
}

const TEMPLATE_BOOK_AVAILABILITY = "check_availability";
const TEMPLATE_BOOK_IS_FREE = "check_is_free";
const TEMPLATE_BOOK_GET_PAYMENT_LINK = "get_payment_link";

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
  /**
   * Hosted Supabase Edge requires `apikey` + `Authorization: Bearer <anon JWT>`.
   * Prefer `SUPABASE_ANON_KEY`; fall back to `EXPO_PUBLIC_SUPABASE_ANON_KEY` so Railway can reuse
   * the same variable name many Expo projects already have (no service role on the Node service).
   */
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
  if (patch.payment_link !== undefined) {
    body.payment_link = patch.payment_link == null ? null : String(patch.payment_link);
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

/** Optional secondary webhook (non-Supabase shape). */
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

async function createBooking(payload) {
  const bookingId = requireStringField(payload, "booking_id");
  const venueName = requireStringField(payload, "venue_name");
  const date = requireStringField(payload, "date");
  const time = requireStringField(payload, "time");
  const ownerPhone = sanitizePhone(requireStringField(payload, "owner_phone"));

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

  log("booking_created", { booking_id: bookingId, owner_phone: ownerPhone, step: booking.step });
  const sendResult = await sendWhatsAppTemplate(ownerPhone, TEMPLATE_BOOK_AVAILABILITY, [
    booking.customer_name ?? "Client",
    booking.customer_phone ?? "—",
    venueName,
    date,
    time,
  ]);
  trackOutboundMessage(booking, sendResult?.message_id);

  await syncCartOrLegacy(
    booking,
    {
      status_lines: ["Message sent to venue.", "Waiting for availability…"],
      confirmable: false,
      payment_link: null,
    },
    { booking_id: booking.id, status: booking.status, step: booking.step, price: null },
  );

  return makeBookingSnapshot(booking);
}

async function handleAvailabilityStep(booking, messageText) {
  const yesNo = parseOwnerYesNo(messageText);
  if (yesNo === "no") {
    booking.status = "rejected";
    booking.step = "completed";
    booking.updated_at = new Date().toISOString();
    removeActiveBooking(booking.owner_phone, booking.id);

    const sendResult = await sendWhatsAppMessage(booking.owner_phone, "Booking marked unavailable. Flow closed.");
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      { status_lines: ["Venue declined this slot."], confirmable: false, payment_link: null },
      { booking_id: booking.id, status: "rejected", step: booking.step },
    );
    return;
  }

  if (yesNo === "yes") {
    booking.status = "available";
    booking.step = "pricing";
    booking.updated_at = new Date().toISOString();

    const sendResult = await sendWhatsAppTemplate(booking.owner_phone, TEMPLATE_BOOK_IS_FREE);
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: ["Slot available.", "Checking if booking is free…"],
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  const sendResult = await sendWhatsAppMessage(booking.owner_phone, "Please reply YES or NO.");
  trackOutboundMessage(booking, sendResult?.message_id);
}

async function handlePricingStep(booking, messageText) {
  const yesNo = parseOwnerYesNo(messageText);
  if (yesNo === "yes") {
    booking.is_free = true;
    booking.price = 0;
    booking.status = "confirmed_free";
    booking.step = "completed";
    booking.updated_at = new Date().toISOString();
    removeActiveBooking(booking.owner_phone, booking.id);

    const sendResult = await sendWhatsAppMessage(booking.owner_phone, "Marked as free. Customer can now confirm.");
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: ["Slot available and free.", "Customer can now tap Confirm."],
        confirmable: true,
        confirmed_price: "0",
        payment_link: null,
      },
      { booking_id: booking.id, status: "confirmed", price: 0, step: booking.step },
    );
    return;
  }

  if (yesNo === "no") {
    booking.is_free = false;
    booking.status = "payment_link_requested";
    booking.step = "pricing_payment_link_input";
    booking.updated_at = new Date().toISOString();

    const sendResult = await sendWhatsAppTemplate(booking.owner_phone, TEMPLATE_BOOK_GET_PAYMENT_LINK);
    trackOutboundMessage(booking, sendResult?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: ["Slot available.", "Awaiting payment link from venue…"],
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  const sendResult = await sendWhatsAppMessage(booking.owner_phone, "Please reply YES or NO.");
  trackOutboundMessage(booking, sendResult?.message_id);
}

async function handlePricingPaymentLinkInputStep(booking, messageText) {
  const paymentLink = parsePaymentLink(messageText);
  if (paymentLink == null) {
    const sendResultTemplate = await sendWhatsAppTemplate(booking.owner_phone, TEMPLATE_BOOK_GET_PAYMENT_LINK);
    trackOutboundMessage(booking, sendResultTemplate?.message_id);
    const sendResultMessage = await sendWhatsAppMessage(booking.owner_phone, "Please send a valid http/https payment link.");
    trackOutboundMessage(booking, sendResultMessage?.message_id);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: ["Slot available.", "Awaiting valid payment link from venue…"],
        confirmable: false,
        payment_link: null,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  booking.payment_link = paymentLink;
  booking.status = "awaiting_payment";
  booking.step = "completed";
  booking.updated_at = new Date().toISOString();
  removeActiveBooking(booking.owner_phone, booking.id);

  const sendResult = await sendWhatsAppMessage(booking.owner_phone, "Got it. Payment link recorded.");
  trackOutboundMessage(booking, sendResult?.message_id);
  await syncCartOrLegacy(
    booking,
    {
      status_lines: ["Payment link ready.", "Customer can now tap Confirm or Pay in the app."],
      confirmable: true,
      payment_link: paymentLink,
    },
    { booking_id: booking.id, status: "confirmed", payment_link: paymentLink, step: booking.step },
  );
}

async function processIncomingWhatsApp(payload) {
  const from = sanitizePhone(requireStringField(payload, "from"));
  const message = requireStringField(payload, "message");

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
    step: booking.step,
    status: booking.status,
    message,
  });

  if (booking.step === "availability") {
    await handleAvailabilityStep(booking, message);
  } else if (booking.step === "pricing") {
    await handlePricingStep(booking, message);
  } else if (booking.step === "pricing_payment_link_input") {
    await handlePricingPaymentLinkInputStep(booking, message);
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

  const line = deliveryStatusLine(status, errorDetails);
  booking.updated_at = new Date().toISOString();
  log("delivery_status_ingested", { booking_id: booking.id, message_id: messageId, status, error_details: errorDetails || null });

  await syncCartOrLegacy(
    booking,
    {
      status_lines: [line],
      confirmable: booking.status === "confirmed_free" || booking.status === "awaiting_payment",
      confirmed_price: booking.status === "confirmed_free" ? "0" : undefined,
      payment_link: booking.payment_link ?? null,
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
          if (from && text) inbound.push({ from, message: text });
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
    availability_template: TEMPLATE_BOOK_AVAILABILITY,
    is_free_template: TEMPLATE_BOOK_IS_FREE,
    payment_link_template: TEMPLATE_BOOK_GET_PAYMENT_LINK,
  };
}

module.exports = {
  createBooking,
  processIncomingWhatsApp,
  processWhatsAppWebhook,
  getDebugState,
  getRuntimeTemplateConfig,
  /** @deprecated use syncCartOrLegacy via createBooking; kept for ad-hoc tests */
  notifyApp: notifyLegacyApp,
};
