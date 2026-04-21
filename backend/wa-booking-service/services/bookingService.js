const { parsePrice, parseYesNo } = require("./parser");
const { sendWhatsAppMessage, sendWhatsAppTemplate } = require("./whatsapp");

const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || "https://example.com/api/update-booking";
const APP_NOTIFY_RETRIES = Number.parseInt(process.env.APP_NOTIFY_RETRIES || "3", 10);
const APP_NOTIFY_TIMEOUT_MS = Number.parseInt(process.env.APP_NOTIFY_TIMEOUT_MS || "5000", 10);

const bookingsById = new Map();
const activeBookingIdsByPhone = new Map();

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

function optionalTrimString(payload, key) {
  const value = payload[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function addActiveBooking(phone, bookingId) {
  const normalizedPhone = sanitizePhone(phone);
  const existing = activeBookingIdsByPhone.get(normalizedPhone) || [];
  const updated = existing.filter((id) => id !== bookingId);
  updated.push(bookingId);
  activeBookingIdsByPhone.set(normalizedPhone, updated);
}

function removeActiveBooking(phone, bookingId) {
  const normalizedPhone = sanitizePhone(phone);
  const existing = activeBookingIdsByPhone.get(normalizedPhone) || [];
  const updated = existing.filter((id) => id !== bookingId);
  if (updated.length === 0) {
    activeBookingIdsByPhone.delete(normalizedPhone);
    return;
  }
  activeBookingIdsByPhone.set(normalizedPhone, updated);
}

function getLatestActiveBookingByPhone(phone) {
  const normalizedPhone = sanitizePhone(phone);
  const ids = activeBookingIdsByPhone.get(normalizedPhone) || [];
  for (let idx = ids.length - 1; idx >= 0; idx -= 1) {
    const booking = bookingsById.get(ids[idx]);
    if (booking && booking.step !== "completed") {
      return booking;
    }
  }
  return null;
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
  };
}

function requireStringField(payload, fieldName) {
  const value = payload[fieldName];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid or missing field: ${fieldName}`);
  }
  return value.trim();
}

const TEMPLATE_BOOK_AVAILABILITY = "book_availability_v1";
const TEMPLATE_BOOK_IS_FREE = "book_is_free";
const TEMPLATE_BOOK_GET_PRICE = "book_get_price";

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
    supabase_callback_url: optionalTrimString(payload, "supabase_callback_url"),
    supabase_callback_token: optionalTrimString(payload, "supabase_callback_token"),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  bookingsById.set(bookingId, booking);
  addActiveBooking(ownerPhone, bookingId);

  log("booking_created", { booking_id: bookingId, owner_phone: ownerPhone, step: booking.step });
  await sendWhatsAppTemplate(ownerPhone, TEMPLATE_BOOK_AVAILABILITY, [
    booking.customer_name ?? "Client",
    booking.customer_phone ?? "—",
    venueName,
    date,
    time,
  ]);

  await syncCartOrLegacy(
    booking,
    {
      status_lines: ["Message sent to venue.", "Waiting for availability…"],
      confirmable: false,
    },
    { booking_id: booking.id, status: booking.status, step: booking.step, price: null },
  );

  return makeBookingSnapshot(booking);
}

async function handleAvailabilityStep(booking, messageText) {
  const yesNo = parseYesNo(messageText);
  if (yesNo === "no") {
    booking.status = "rejected";
    booking.step = "completed";
    booking.updated_at = new Date().toISOString();
    removeActiveBooking(booking.owner_phone, booking.id);

    await sendWhatsAppMessage(booking.owner_phone, "Booking marked unavailable. Flow closed.");
    await syncCartOrLegacy(
      booking,
      { status_lines: ["Venue declined this slot."], confirmable: false },
      { booking_id: booking.id, status: "rejected", step: booking.step },
    );
    return;
  }

  if (yesNo === "yes") {
    booking.status = "available";
    booking.step = "pricing";
    booking.updated_at = new Date().toISOString();

    await sendWhatsAppTemplate(booking.owner_phone, TEMPLATE_BOOK_IS_FREE);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: ["Slot available.", "Checking if booking is free…"],
        confirmable: false,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  await sendWhatsAppMessage(booking.owner_phone, "Please reply YES or NO.");
}

async function handlePricingStep(booking, messageText) {
  const yesNo = parseYesNo(messageText);
  if (yesNo === "yes") {
    booking.is_free = true;
    booking.price = 0;
    booking.status = "confirmed_free";
    booking.step = "completed";
    booking.updated_at = new Date().toISOString();
    removeActiveBooking(booking.owner_phone, booking.id);

    await sendWhatsAppMessage(booking.owner_phone, "Marked as free. Customer can now confirm.");
    await syncCartOrLegacy(
      booking,
      {
        status_lines: ["Slot available and free.", "Customer can now tap Confirm."],
        confirmable: true,
        confirmed_price: "0",
      },
      { booking_id: booking.id, status: "confirmed", price: 0, step: booking.step },
    );
    return;
  }

  if (yesNo === "no") {
    booking.is_free = false;
    booking.status = "price_requested";
    booking.step = "pricing_price_input";
    booking.updated_at = new Date().toISOString();

    await sendWhatsAppTemplate(booking.owner_phone, TEMPLATE_BOOK_GET_PRICE);
    await syncCartOrLegacy(
      booking,
      {
        status_lines: ["Slot available.", "Awaiting price from venue…"],
        confirmable: false,
      },
      { booking_id: booking.id, status: booking.status, step: booking.step },
    );
    return;
  }

  await sendWhatsAppMessage(booking.owner_phone, "Please reply YES or NO.");
}

async function handlePricingPriceInputStep(booking, messageText) {
  const price = parsePrice(messageText);
  if (price == null) {
    await sendWhatsAppTemplate(booking.owner_phone, TEMPLATE_BOOK_GET_PRICE);
    return;
  }

  booking.price = price;
  booking.status = "awaiting_payment";
  booking.step = "completed";
  booking.updated_at = new Date().toISOString();
  removeActiveBooking(booking.owner_phone, booking.id);

  await sendWhatsAppMessage(booking.owner_phone, `Got it. Price recorded: ${price}.`);
  await syncCartOrLegacy(
    booking,
    {
      status_lines: [`Price set: ${price}.`, `Customer can now tap Pay ${price} $ in the app.`],
      confirmable: true,
      confirmed_price: String(price),
    },
    { booking_id: booking.id, status: "confirmed", price, step: booking.step },
  );
}

async function processIncomingWhatsApp(payload) {
  const from = sanitizePhone(requireStringField(payload, "from"));
  const message = requireStringField(payload, "message");

  const booking = getLatestActiveBookingByPhone(from);
  if (!booking) {
    log("no_active_booking_for_phone", { from, message });
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

function getDebugState() {
  const bookings = Array.from(bookingsById.values()).map(makeBookingSnapshot);
  return {
    bookings,
    activeBookingIdsByPhone: Object.fromEntries(activeBookingIdsByPhone.entries()),
  };
}

module.exports = {
  createBooking,
  processIncomingWhatsApp,
  getDebugState,
  /** @deprecated use syncCartOrLegacy via createBooking; kept for ad-hoc tests */
  notifyApp: notifyLegacyApp,
};
