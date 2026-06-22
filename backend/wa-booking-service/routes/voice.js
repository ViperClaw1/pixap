const express = require("express");
const { handleRetellWebhook } = require("../services/voiceBookingService");

const router = express.Router();

router.post("/retell-webhook", async (req, res) => {
  try {
    await handleRetellWebhook(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[voice-route] retell-webhook error", err);
    res.status(500).json({ ok: false, error: "Internal error" });
  }
});

module.exports = router;
