const express = require("express");
const { processIncomingWhatsApp, processWhatsAppWebhook } = require("../services/bookingService");
const { handleMetaWebhookVerify } = require("../utils/metaWebhookVerify");

const router = express.Router();

function handleGetVerify(req, res) {
  if (handleMetaWebhookVerify(req, res)) return;
  res.status(405).set("Allow", "GET (Meta verify), POST").json({
    ok: false,
    error: "Method Not Allowed",
    hint: "POST JSON here (WhatsApp inbound). Meta dashboard verification sends GET with hub.* query params.",
  });
}

async function handleInbound(req, res) {
  try {
    const body = req.body || {};
    const isMetaWebhook = Array.isArray(body?.entry);
    console.log(
      JSON.stringify({
        scope: "route_whatsapp",
        action: "incoming_webhook",
        path: req.originalUrl,
        is_meta_webhook: isMetaWebhook,
        has_from: typeof body?.from === "string",
        has_message: typeof body?.message === "string",
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
              scope: "route_whatsapp",
              action: "meta_webhook_processed",
              path: req.originalUrl,
              statuses_ingested: result?.ingested?.statuses ?? null,
              inbound_ingested: result?.ingested?.inbound_messages ?? null,
              timestamp: new Date().toISOString(),
            }),
          );
        })
        .catch((error) => {
          console.error("[route:/webhook/whatsapp] async meta processing error", error);
        });
      return;
    }

    const result = await processIncomingWhatsApp(body);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[route:/webhook/whatsapp] error", error);
    return res.status(400).json({
      ok: false,
      error: error.message || "Invalid WhatsApp webhook payload",
    });
  }
}

router.get("/whatsapp", handleGetVerify);
router.get("/", handleGetVerify);
router.post("/whatsapp", handleInbound);
router.post("/", handleInbound);

module.exports = router;
