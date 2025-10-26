const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const router = express.Router();

// Monri credentials & URLs
const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // public / slave token
const MONRI_KEY = process.env.MONRI_KEY;               // private / master key for digest
const MONRI_RETURN_URL = process.env.MONRI_RETURN_URL || "https://yourfrontend.com/success";
const MONRI_CANCEL_URL = process.env.MONRI_CANCEL_URL || "https://yourfrontend.com/cancel";
const MONRI_CALLBACK_URL = process.env.MONRI_CALLBACK_URL || "https://yourbackend.com/api/payment/callback";

// Base URL depending on environment
const MONRI_BASE_URL = process.env.NODE_ENV === "production"
  ? "https://ipg.monri.com"
  : "https://ipgtest.monri.com";

/**
 * STEP 1: Create payment via Monri API (server-side)
 */
router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency || !customer?.full_name || !customer?.email) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const order_number = `ORD-${Date.now()}`;
    const order_info = `Order ${order_number}`;
    const amountMinor = Math.round(amount * 100); // Convert to minor units

    // Build request payload
    const payload = {
      amount: amountMinor,
      order_number,
      currency,
      transaction_type: "purchase",
      order_info,
      ch_full_name: customer.full_name,
      ch_email: customer.email,
      language: "en",
      callback_url: MONRI_CALLBACK_URL,
      cancel_url: MONRI_CANCEL_URL,
      success_url_override: MONRI_RETURN_URL,
    };

    // Construct digest and Authorization header
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyAsString = JSON.stringify(payload);
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + timestamp + MONRI_AUTH_TOKEN + bodyAsString)
      .digest("hex");

    const authorizationHeader = `WP3-v2 ${MONRI_AUTH_TOKEN} ${timestamp} ${digest}`;

    // Send request to Monri API
    const response = await axios.post(`${MONRI_BASE_URL}/v2/payment/new`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: authorizationHeader,
      },
    });

    // Return Monri API response to frontend
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Monri create-payment error:", error.response?.data || error.message);
    res.status(500).json({ message: "Server error while creating payment" });
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
