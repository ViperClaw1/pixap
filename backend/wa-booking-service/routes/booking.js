const express = require("express");
const { createBooking } = require("../services/bookingService");
const { processIncomingWhatsApp, processWhatsAppWebhook } = require("../services/bookingService");
const { handleMetaWebhookVerify } = require("../utils/metaWebhookVerify");

const router = express.Router();

router.get("/booking", (req, res) => {
  if (handleMetaWebhookVerify(req, res)) return;
  res.status(405).set("Allow", "GET (Meta verify), POST").json({
    ok: false,
    error: "Method Not Allowed",
    hint: "POST JSON here (Supabase n8n-wa-booking-start). For Meta webhook verification, use the same verify token env as /webhook/whatsapp; prefer configuring Meta on POST {base}/webhook/whatsapp.",
  });
});

router.post("/booking", async (req, res) => {
  try {
    const body = req.body || {};
    const isMetaWebhook = Array.isArray(body?.entry);
    const isSimplifiedInbound = typeof body?.from === "string" && typeof body?.message === "string";
    console.log(
      JSON.stringify({
        scope: "route_booking",
        action: "incoming_post",
        path: "/webhook/booking",
        is_meta_webhook: isMetaWebhook,
        is_simplified_inbound: isSimplifiedInbound,
        has_booking_id: typeof body?.booking_id === "string",
        entry_count: isMetaWebhook ? body.entry.length : 0,
        timestamp: new Date().toISOString(),
      }),
    );
    if (isMetaWebhook) {
      // Meta retries aggressively when webhook processing is slow; ACK first, process async.
      res.status(200).json({ ok: true, accepted: true });
      void processWhatsAppWebhook(body)
        .then((result) => {
          console.log(
            JSON.stringify({
              scope: "route_booking",
              action: "meta_webhook_processed",
              path: "/webhook/booking",
              statuses_ingested: result?.ingested?.statuses ?? null,
              inbound_ingested: result?.ingested?.inbound_messages ?? null,
              timestamp: new Date().toISOString(),
            }),
          );
        })
        .catch((error) => {
          console.error("[route:/webhook/booking] async meta processing error", error);
        });
      return;
    }

    if (isSimplifiedInbound) {
      const result = await processIncomingWhatsApp(body);
      return res.status(200).json(result);
    }

    const booking = await createBooking(body);
    return res.status(202).json({
      ok: true,
      booking,
    });
  } catch (error) {
    console.error("[route:/webhook/booking] error", error);
    return res.status(400).json({
      ok: false,
      error: error.message || "Invalid booking request",
    });
  }
});

module.exports = router;
