const express = require("express");
const { processIncomingWhatsApp } = require("../services/bookingService");

const router = express.Router();

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
