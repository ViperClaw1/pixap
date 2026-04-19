const express = require("express");
const { processIncomingWhatsApp } = require("../services/bookingService");
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
    const result = await processIncomingWhatsApp(req.body || {});
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
