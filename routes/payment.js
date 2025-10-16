const express = require("express");
const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN;
const MONRI_KEY = process.env.MONRI_KEY;

router.post("/create-payment", async (req, res) => {
  try {
    let { amount, currency, customer } = req.body;

    if (!amount || !currency || !customer) {
      return res.status(400).json({ message: "Missing amount, currency or customer info" });
    }

    amount = parseInt(amount);

    const timestamp = Date.now().toString();
    const order_number = "ORDER_" + timestamp;

    // Flatten customer fields with defaults
    const payload = {
      transaction_type: "purchase",
      order_number,
      amount,
      currency,
      ch_full_name: customer.ch_full_name || "Test User",
      ch_email: customer.ch_email || "test@test.com",
      ch_address: customer.ch_address || "Test Address",
      ch_city: customer.ch_city || "Test City",
      ch_zip: customer.ch_zip || "00000",
      ch_country: customer.ch_country || "BA",
      ch_phone: customer.ch_phone || "00000000",
    };

    console.log("📦 Payload to Monri:", payload);

    const signature = crypto
      .createHmac("sha512", MONRI_KEY)
      .update(timestamp + order_number + amount + currency)
      .digest("hex");

    const monriRes = await fetch("https://ipgtest.monri.com/api/v2/payment/new", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MONRI_AUTH_TOKEN}`,
        "Content-Type": "application/json",
        "X-Monri-Timestamp": timestamp,
        "X-Monri-Signature": signature,
      },
      body: JSON.stringify(payload),
    });

    const text = await monriRes.text(); // read body once
    let monriData;
    try {
      monriData = JSON.parse(text);
    } catch (e) {
      console.error("❌ Failed to parse JSON from Monri:", text);
      return res.status(500).json({ message: "Invalid response from Monri", details: text });
    }

    console.log("📩 Monri API Response:", monriData);

    if (!monriData.client_secret) {
      return res.status(500).json({ message: "Monri did not return client_secret", details: monriData });
    }

    res.json({ client_secret: monriData.client_secret });

  } catch (err) {
    console.error("❌ Backend crash:", err);
    res.status(500).json({ message: err.message || "Payment init failed" });
  }
});

module.exports = router;
