// backend/routes/paymentRoutes.js
const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// ✅ Load environment variables
const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // Public/slave token
const MONRI_KEY = process.env.MONRI_KEY; // Private/master key
const MONRI_RETURN_URL = process.env.MONRI_RETURN_URL || "https://yourfrontend.com/success";
const MONRI_CALLBACK_URL = process.env.MONRI_CALLBACK_URL || "https://yourbackend.com/api/payment/callback";
const MONRI_CANCEL_URL = process.env.MONRI_CANCEL_URL || "https://yourfrontend.com/cancel";

// ✅ Monri endpoints
const MONRI_FORM_URL = process.env.NODE_ENV === "production"
  ? "https://ipg.monri.com/v2/form"
  : "https://ipgtest.monri.com/v2/form";

/**
 * STEP 1: Create Redirect form data for frontend submission
 * The frontend will take this response, build a hidden <form>, and auto-submit it.
 */
router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency || !customer?.full_name || !customer?.email) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const order_number = `ORD-${Date.now()}`;
    const order_info = `Order ${order_number}`;

    // ✅ Calculate Monri digest according to docs:
    // digest = SHA512(MONRI_KEY + order_number + amount + currency)
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + order_number + amount.toString() + currency)
      .digest("hex");

    // ✅ Build POST fields
    const formData = {
      authenticity_token: MONRI_AUTH_TOKEN,
      order_number,
      amount,
      currency,
      order_info,
      ch_full_name: customer.full_name,
      ch_email: customer.email,
      language: "en",
      transaction_type: "purchase",
      digest,
      success_url_override: MONRI_RETURN_URL,
      callback_url: MONRI_CALLBACK_URL,
      cancel_url: MONRI_CANCEL_URL,
    };

    // ✅ Return everything to frontend
    res.status(200).json({
      formAction: MONRI_FORM_URL,
      formData,
    });
  } catch (error) {
    console.error("Monri create-payment error:", error);
    res.status(500).json({ message: "Server error while creating payment" });
  }
});

/**
 * STEP 2: Handle Monri callback (server-to-server notification)
 * Verifies Monri's signature to ensure authenticity.
 */
router.post("/callback", express.json({ type: "*/*" }), (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const monriDigest = req.headers["authorization"]?.split(" ")[1];

    // ✅ Recalculate the digest to verify Monri source
    const calculatedDigest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + rawBody)
      .digest("hex");

    if (calculatedDigest !== monriDigest) {
      console.warn("⚠️ Invalid Monri callback signature detected");
      return res.status(403).send("Invalid signature");
    }

    const transaction = req.body;
    console.log("✅ Verified Monri callback:", transaction);

    // TODO: update your database with transaction info (approved, declined, etc.)

    res.status(200).send("OK");
  } catch (error) {
    console.error("Monri callback error:", error);
    res.status(500).send("Server error");
  }
});

/**
 * STEP 3: Handle Monri success redirect (optional)
 * This is a GET request where Monri appends query params.
 */
router.get("/success", (req, res) => {
  const params = req.query;

  // ✅ Recalculate success URL digest for validation
  const urlWithoutDigest = `${req.protocol}://${req.get("host")}${req.originalUrl.split("&digest=")[0]}`;
  const digest = crypto
    .createHash("sha512")
    .update(MONRI_KEY + urlWithoutDigest)
    .digest("hex");

  if (digest !== params.digest) {
    console.warn("⚠️ Invalid Monri success URL digest");
    return res.status(403).send("Invalid digest");
  }

  // ✅ Everything checks out
  res.redirect(`${MONRI_RETURN_URL}?status=success&order_number=${params.order_number}`);
});

module.exports = router;
