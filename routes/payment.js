const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // authenticity token
const MONRI_KEY = process.env.MONRI_KEY;               // merchant key

const MONRI_RETURN_URL = process.env.MONRI_RETURN_URL || "https://yourfrontend.com/success";
const MONRI_CANCEL_URL = process.env.MONRI_CANCEL_URL || "https://yourfrontend.com/cancel";
const MONRI_CALLBACK_URL = process.env.MONRI_CALLBACK_URL || "https://yourbackend.com/api/payment/callback";

const MONRI_FORM_URL =
  process.env.NODE_ENV === "production"
    ? "https://ipg.monri.com/v2/form"
    : "https://ipgtest.monri.com/v2/form";



/**
 * STEP 2: Handle Monri callback (server-to-server notification)
 * Verify digest using WP3 standard: SHA512(MONRI_KEY + rawBody)
 */
router.post("/create-payment", (req, res) => {
  try {
    const { amount, currency, order_number } = req.body;

    const raw = MONRI_KEY + order_number + amount + currency;
    const digest = crypto.createHash("sha512").update(raw).digest("hex");

    res.json({
      authenticity_token: MONRI_AUTH_TOKEN,
      digest,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create payment digest" });
  }
});

/**
 * STEP 3: Optional success redirect (frontend)
 */
router.get("/success", (req, res) => {
  const params = req.query;

  // You can optionally verify digest if Monri provides it in query
  // For now, just redirect to frontend success page
  res.redirect(`${MONRI_RETURN_URL}?status=success&order_number=${params.order_number}`);
});

module.exports = router;
