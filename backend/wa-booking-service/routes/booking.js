const express = require("express");
const { createBooking } = require("../services/bookingService");
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
    const booking = await createBooking(req.body || {});
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
