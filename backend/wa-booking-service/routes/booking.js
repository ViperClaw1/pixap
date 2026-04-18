const express = require("express");
const { createBooking } = require("../services/bookingService");

const router = express.Router();

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
