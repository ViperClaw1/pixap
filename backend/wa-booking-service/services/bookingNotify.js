const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || "https://example.com/api/update-booking";
const APP_NOTIFY_RETRIES = Number.parseInt(process.env.APP_NOTIFY_RETRIES || "3", 10);
const APP_NOTIFY_TIMEOUT_MS = Number.parseInt(process.env.APP_NOTIFY_TIMEOUT_MS || "5000", 10);

function log(action, details) {
  console.log(
    JSON.stringify({
      scope: "booking_notify",
      action,
      ...details,
      timestamp: new Date().toISOString(),
    }),
  );
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
      hint: "Set SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY. Without it no callback is sent.",
    });
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
      if (secret) headers["x-wa-booking-secret"] = secret;
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

module.exports = { syncCartOrLegacy, postSupabaseCartCallback, notifyLegacyApp, hasSupabaseCartIntegration };
