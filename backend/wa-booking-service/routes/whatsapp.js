const express = require("express");
const { processIncomingWhatsApp, processWhatsAppWebhook } = require("../services/bookingService");
const { handleMetaWebhookVerify } = require("../utils/metaWebhookVerify");

const router = express.Router();

router.get("/whatsapp", (req, res) => {
  if (handleMetaWebhookVerify(req, res)) return;
  res.status(405).set("Allow", "GET (Meta verify), POST").json({
    ok: false,
    error: "Method Not Allowed",
    hint: "POST JSON here (WhatsApp inbound). Meta dashboard verification sends GET with hub.* query params.",
  });
});

router.post("/whatsapp", async (req, res) => {
  try {
    const body = req.body || {};
    const isMetaWebhook = Array.isArray(body?.entry);
    console.log(
      JSON.stringify({
        scope: "route_whatsapp",
        action: "incoming_webhook",
        path: "/webhook/whatsapp",
        is_meta_webhook: isMetaWebhook,
        has_from: typeof body?.from === "string",
        has_message: typeof body?.message === "string",
        entry_count: isMetaWebhook ? body.entry.length : 0,
        timestamp: new Date().toISOString(),
      }),
    );
    const result = isMetaWebhook ? await processWhatsAppWebhook(body) : await processIncomingWhatsApp(body);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[route:/webhook/whatsapp] error", error);
    return res.status(400).json({
      ok: false,
      error: error.message || "Invalid WhatsApp webhook payload",
    });
  }
});

module.exports = router;
