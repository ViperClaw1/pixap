const express = require("express");
const { processIncomingSms, processSmsDeliveryStatus } = require("../services/smsBookingService");

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

// Twilio async delivery status webhook — set TWILIO_STATUS_CALLBACK_URL to this endpoint's public URL
router.post("/sms-status", async (req, res) => {
  // Respond immediately — Twilio retries on non-2xx
  res.sendStatus(204);

  const messageSid = String(req.body?.MessageSid || "").trim();
  const messageStatus = String(req.body?.MessageStatus || "").trim();

  if (!messageSid) return;

  try {
    await processSmsDeliveryStatus({ messageSid, messageStatus });
  } catch (err) {
    console.error("[sms-route] sms-status error", err);
  }
});

module.exports = router;
