import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Body = {
  callback_token?: string;
  status_lines?: unknown;
  confirmable?: boolean;
  confirmed_slot?: string | null;
  confirmed_price?: string | null;
  payment_link?: string | null;
};

type CartItemRow = {
  id: string;
  status: string;
  user_id: string;
  business_card_id: string;
  date_time: string;
  created_at: string;
  wa_n8n_callback_token: string | null;
};

type BookingCandidate = {
  id: string;
  created_at: string;
};

function jsonHeaders() {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

function normalizeStatusLines(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") return null;
    out.push(x);
  }
  return out;
}

function statusLinesIndicateRejection(lines: string[]): boolean {
  return /(not available|unavailable|slot is not available|declin|недоступен|отклон|reject)/i.test(lines.join(" "));
}

function findClosestBookingCandidate(
  candidates: BookingCandidate[],
  cartCreatedAt: string,
): BookingCandidate | null {
  if (candidates.length === 0) return null;
  const cartMs = new Date(cartCreatedAt).getTime();
  if (Number.isNaN(cartMs)) return candidates[0];

  return candidates.reduce((best, current) => {
    const bestMs = new Date(best.created_at).getTime();
    const currentMs = new Date(current.created_at).getTime();
    const bestDistance = Number.isNaN(bestMs) ? Number.POSITIVE_INFINITY : Math.abs(bestMs - cartMs);
    const currentDistance = Number.isNaN(currentMs) ? Number.POSITIVE_INFINITY : Math.abs(currentMs - cartMs);
    return currentDistance < bestDistance ? current : best;
  });
}

function bearerToken(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

/**
 * Shared secret for server → this function.
 * Prefer **`x-wa-booking-secret`** so **`Authorization`** can carry the Supabase **anon JWT**
 * (`Bearer <SUPABASE_ANON_KEY>`), which the hosted API gateway requires. Putting the inbound
 * secret in `Authorization` alone fails with `UNAUTHORIZED_INVALID_JWT_FORMAT` because it is not a JWT.
 */
function callbackSharedSecret(req: Request): string | null {
  const fromDedicated =
    req.headers.get("x-wa-booking-secret") ?? req.headers.get("X-Wa-Booking-Secret") ?? "";
  const t = fromDedicated.trim();
  if (t) return t;
  return bearerToken(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders(),
    });
  }

  const secretRaw = Deno.env.get("N8N_INBOUND_SECRET");
  const secret = secretRaw?.trim() ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceKey || !supabaseUrl) {
    console.error("[n8n-wa-booking-callback] Missing Supabase service env");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  if (secret.length > 0) {
    const token = callbackSharedSecret(req);
    if (!token || token !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders(),
      });
    }
  } else {
    console.warn("[n8n-wa-booking-callback] N8N_INBOUND_SECRET unset — callback is open (set secret for production)");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const callbackToken = typeof body.callback_token === "string" ? body.callback_token.trim() : "";
  if (!callbackToken) {
    return new Response(JSON.stringify({ error: "Missing callback_token" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const lines = normalizeStatusLines(body.status_lines);
  if (lines === null) {
    return new Response(JSON.stringify({ error: "status_lines must be a JSON array of strings" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const confirmable = Boolean(body.confirmable);
  const slot = body.confirmed_slot != null ? String(body.confirmed_slot).trim() || null : null;
  const price = body.confirmed_price != null ? String(body.confirmed_price).trim() || null : null;
  const paymentLink =
    body.payment_link !== undefined
      ? body.payment_link != null
        ? String(body.payment_link).trim() || null
        : null
      : undefined;

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: row, error: selErr } = await db
    .from("cart_items")
    .select("id, status, user_id, business_card_id, date_time, created_at, wa_n8n_callback_token")
    .eq("wa_n8n_callback_token", callbackToken)
    .eq("status", "created")
    .maybeSingle<CartItemRow>();

  if (selErr) {
    console.error("[n8n-wa-booking-callback] select", selErr);
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
  if (!row) {
    return new Response(JSON.stringify({ error: "Unknown or inactive cart item" }), {
      status: 404,
      headers: jsonHeaders(),
    });
  }

  const patch: Record<string, unknown> = {
    wa_status_lines: lines,
    wa_confirmable: confirmable,
  };
  if (slot !== null) patch.wa_confirmed_slot = slot;
  if (price !== null) patch.wa_confirmed_price = price;
  // Only persist non-empty links (legacy field). Omitting null avoids PostgREST errors when
  // migration 20260425_cart_items_wa_payment_link has not been applied yet.
  if (paymentLink != null && paymentLink.length > 0) {
    patch.wa_payment_link = paymentLink;
  }

  const { error: updErr } = await db.from("cart_items").update(patch).eq("id", row.id);
  if (updErr) {
    console.error("[n8n-wa-booking-callback] update", updErr);
    const missingPaymentLinkCol = /wa_payment_link/i.test(updErr.message ?? "");
    return new Response(
      JSON.stringify({
        error: updErr.message,
        ...(missingPaymentLinkCol
          ? {
              hint:
                "Apply migration 20260425_cart_items_wa_payment_link.sql (supabase db push), then retry.",
            }
          : {}),
      }),
      {
        status: 500,
        headers: jsonHeaders(),
      },
    );
  }

  let cancelledBookingId: string | null = null;
  if (statusLinesIndicateRejection(lines)) {
    const { data: bookingCandidates, error: bookingSelectErr } = await db
      .from("bookings")
      .select("id, created_at")
      .eq("user_id", row.user_id)
      .eq("business_card_id", row.business_card_id)
      .eq("date_time", row.date_time)
      .eq("status", "upcoming")
      .order("created_at", { ascending: false });

    if (bookingSelectErr) {
      console.error("[n8n-wa-booking-callback] select linked booking", bookingSelectErr);
      return new Response(JSON.stringify({ error: bookingSelectErr.message }), {
        status: 500,
        headers: jsonHeaders(),
      });
    }

    const linkedBooking = findClosestBookingCandidate(
      (bookingCandidates ?? []) as BookingCandidate[],
      row.created_at,
    );
    if (linkedBooking) {
      const { error: bookingUpdateErr } = await db
        .from("bookings")
        .update({ status: "expired" })
        .eq("id", linkedBooking.id)
        .eq("status", "upcoming");

      if (bookingUpdateErr) {
        console.error("[n8n-wa-booking-callback] cancel linked booking", bookingUpdateErr);
        return new Response(JSON.stringify({ error: bookingUpdateErr.message }), {
          status: 500,
          headers: jsonHeaders(),
        });
      }
      cancelledBookingId = linkedBooking.id;
    } else {
      console.warn("[n8n-wa-booking-callback] no linked booking to cancel", {
        cart_item_id: row.id,
        user_id: row.user_id,
        business_card_id: row.business_card_id,
        date_time: row.date_time,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, cancelled_booking_id: cancelledBookingId }), {
    status: 200,
    headers: jsonHeaders(),
  });
});
