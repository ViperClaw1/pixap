const express = require("express");
const { processIncomingWhatsApp } = require("../services/bookingService");

const router = express.Router();

router.get("/whatsapp", (_req, res) => {
  res.status(405).set("Allow", "POST").json({
    ok: false,
    error: "Method Not Allowed",
    hint: "POST JSON here (WhatsApp provider inbound webhook).",
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
