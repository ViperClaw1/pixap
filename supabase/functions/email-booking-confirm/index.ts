/**
 * Handles venue confirm/decline clicks from booking email links.
 * GET /functions/v1/email-booking-confirm?booking_id=<id>&action=confirm|decline
 *
 * Returns a simple HTML page so venue owners see a human-readable response.
 */

const ALLOWED_ACTIONS = new Set(["confirm", "decline"]);

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; text-align: center; color: #111; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #6b7280; font-size: 16px; line-height: 1.6; }
    .icon { font-size: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  ${body}
  <p style="margin-top:40px;font-size:12px;color:#9ca3af;">Pixap booking platform</p>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const bookingId = url.searchParams.get("booking_id")?.trim() ?? "";
  const action = url.searchParams.get("action")?.trim() ?? "";

  if (!bookingId || !ALLOWED_ACTIONS.has(action)) {
    return htmlPage(
      "Invalid link",
      `<div class="icon">⚠️</div>
       <h1>Invalid link</h1>
       <p>This booking confirmation link is missing required parameters. Please contact the guest directly.</p>`,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return htmlPage(
      "Server error",
      `<div class="icon">❌</div><h1>Server error</h1><p>Configuration missing. Please contact support.</p>`,
    );
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Update the cart_item's wa_status_lines to reflect venue response
  const statusLine =
    action === "confirm"
      ? "Venue confirmed availability by email. You can confirm the booking in the app."
      : "Venue declined your booking request by email.";

  const { error } = await db
    .from("cart_items")
    .update({
      wa_status_lines: [statusLine],
      wa_confirmable: action === "confirm",
    })
    .eq("id", bookingId);

  if (error) {
    console.error("[email-booking-confirm] db update error", error);
    return htmlPage(
      "Error",
      `<div class="icon">❌</div><h1>Something went wrong</h1><p>${error.message}</p>`,
    );
  }

  if (action === "confirm") {
    return htmlPage(
      "Booking confirmed",
      `<div class="icon">✅</div>
       <h1>Availability confirmed!</h1>
       <p>Thank you. The guest has been notified and can now confirm their booking in the app.</p>`,
    );
  }

  return htmlPage(
    "Booking declined",
    `<div class="icon">❌</div>
     <h1>Booking declined</h1>
     <p>Noted. The guest has been notified that this slot is not available.</p>`,
  );
});
