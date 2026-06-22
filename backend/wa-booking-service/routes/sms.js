const express = require("express");
const { processIncomingSms } = require("../services/smsBookingService");

const router = express.Router();

// Twilio sends form-encoded data — needs urlencoded body parser on this router.
router.use(express.urlencoded({ extended: false }));

router.post("/sms-inbound", async (req, res) => {
  const from = String(req.body?.From || "").trim();
  const message = String(req.body?.Body || "").trim();
  const messageSid = String(req.body?.MessageSid || "").trim();

  if (!from || !message) {
    return res.set("Content-Type", "text/xml").send("<Response></Response>");
  }

  try {
    await processIncomingSms({ from, message, message_id: messageSid });
  } catch (err) {
    console.error("[sms-route] sms-inbound error", err);
  }

  // Twilio expects a TwiML response; empty response = no auto-reply.
  res.set("Content-Type", "text/xml").send("<Response></Response>");
});

module.exports = router;
