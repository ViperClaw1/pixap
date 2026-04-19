const express = require("express");
const { createBooking } = require("../services/bookingService");

const router = express.Router();

router.get("/booking", (_req, res) => {
  res.status(405).set("Allow", "POST").json({
    ok: false,
    error: "Method Not Allowed",
    hint: "POST JSON here (called by Supabase n8n-wa-booking-start). Browsers use GET — use curl/Postman or the app flow.",
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
