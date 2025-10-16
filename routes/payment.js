const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch"); // If using Node < 18, install it

const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // Bearer token
const MONRI_KEY = process.env.MONRI_KEY; // Since you're calculating signature

router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ message: "Missing amount or currency" });
    }

    const timestamp = Date.now().toString();
    const order_number = "ORDER_" + timestamp;

    // Build request payload for Monri Lightbox:
    const payload = {
      transaction_type: "purchase",
      order_number,
      amount,
      currency,
      customer, // Example: { ch_full_name, ch_email, ... }
    };

    // Signature = timestamp + order_number + amount + currency
    const signature = crypto
      .createHmac("sha512", MONRI_KEY)
      .update(timestamp + order_number + amount + currency)
      .digest("hex");

    // Call Monri's Payment Session API:
    const monriRes = await fetch("https://ipgtest.monri.com/api/v2/payment/new", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MONRI_AUTH_TOKEN}`,
        "Content-Type": "application/json",
        "X-Monri-Timestamp": timestamp,
        "X-Monri-Signature": signature,
      },
      body: JSON.stringify(payload),
    });

    const monriData = await monriRes.json();

    if (!monriData?.client_secret) {
      console.error("❌ Monri did not return client_secret:", monriData);
      return res.status(500).json({ message: "Failed to create Monri session" });
    }

    res.json({ client_secret: monriData.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment init failed" });
  }
});

router.post("/callback", (req, res) => {
  console.log("✅ Monri callback received:", req.headers, req.body);
  res.sendStatus(200);
});

module.exports = router;
