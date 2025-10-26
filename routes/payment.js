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

router.post("/create-payment", (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency || !customer?.full_name || !customer?.email) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const order_number = `ORD-${Date.now()}`;
    const amountMinor = Math.round(amount * 100);

    // Compute digest for redirect form
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + order_number + amountMinor + currency)
      .digest("hex");

    const formFields = {
      utf8: "✓",
      authenticity_token: MONRI_AUTH_TOKEN,
      ch_full_name: customer.full_name,
      ch_email: customer.email,
      order_info: `Order ${order_number}`,
      amount: amountMinor,
      order_number,
      currency,
      transaction_type: "purchase",
      digest,
      language: "en",
      success_url_override: MONRI_RETURN_URL,
      cancel_url: MONRI_CANCEL_URL,
      callback_url: MONRI_CALLBACK_URL,
    };

    res.json({
      form_action: MONRI_FORM_URL,
      form_fields: formFields,
    });
  } catch (err) {
    console.error("Monri form creation error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * STEP 2: Handle Monri callback (server-to-server notification)
 * Verify digest using WP3 standard: SHA512(MONRI_KEY + rawBody)
 */
router.post("/callback", express.json({ type: "*/*" }), (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const monriDigest = req.headers["authorization"]?.split(" ")[1];

    const calculatedDigest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + rawBody)
      .digest("hex");

    if (calculatedDigest !== monriDigest) {
      console.warn("⚠️ Invalid Monri callback signature detected");
      return res.status(403).send("Invalid signature");
    }

    console.log("✅ Verified Monri callback:", req.body);

    // TODO: Update your database with transaction info

    res.status(200).send("OK");
  } catch (error) {
    console.error("Monri callback error:", error);
    res.status(500).send("Server error");
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
