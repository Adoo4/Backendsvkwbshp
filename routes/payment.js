const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch"); // ensure installed: npm i node-fetch

const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN;
const MONRI_KEY = process.env.MONRI_KEY;

router.post("/create-payment", async (req, res) => {
  try {
    let { amount, currency, customer } = req.body;

    if (!amount || !currency || !customer) {
      return res
        .status(400)
        .json({ message: "Missing amount, currency, or customer info" });
    }

    // Make sure amount is integer (minor units)
    amount = parseInt(amount);

    const timestamp = Date.now().toString();
    const order_number = "ORDER_" + timestamp;

    // Flatten customer fields according to Monri docs
    const payload = {
      transaction_type: "purchase",
      order_number,
      amount,
      currency,
      ch_full_name: customer.ch_full_name,
      ch_email: customer.ch_email,
      ch_address: customer.ch_address,
      ch_city: customer.ch_city,
      ch_zip: customer.ch_zip,
      ch_country: customer.ch_country,
      ch_phone: customer.ch_phone,
    };

    console.log("📦 Payload to Monri:", payload);

    // Generate HMAC signature
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

    // Try parsing JSON, but fallback to text if Monri returns HTML
    let monriData;
    try {
      monriData = await monriRes.json();
    } catch (err) {
      const text = await monriRes.text();
      console.error("❌ Monri returned non-JSON response:", text);
      return res
        .status(500)
        .json({ message: "Monri API returned non-JSON response", details: text });
    }

    console.log("📩 Monri API Response:", monriData);

    if (!monriData?.client_secret) {
      console.error("❌ No client_secret returned:", monriData);
      return res.status(500).json({ message: "Failed to create Monri session" });
    }

    res.json({ client_secret: monriData.client_secret });
  } catch (err) {
    console.error("❌ Backend crash:", err);
    res.status(500).json({ message: err.message || "Payment init failed" });
  }
});

module.exports = router;
