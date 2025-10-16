
const express = require("express");
const crypto = require("crypto");

const router = express.Router();   // ✅ THIS LINE WAS MISSING

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN;
const MONRI_KEY = process.env.MONRI_KEY;



router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ message: "Missing amount or currency" });
    }

    const timestamp = Date.now().toString();
    const order_number = "ORDER_" + timestamp;

    const payload = {
      transaction_type: "purchase",
      order_number,
      amount,
      currency,
      customer,
    };

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

    if (!monriRes.ok) {
      const errorText = await monriRes.text();
      console.error("❌ Monri rejected the request:", monriRes.status, errorText);
      return res.status(500).json({ message: "Monri API error", details: errorText });
    }

    const monriData = await monriRes.json();
    console.log("📩 Monri API Response:", monriData);
    console.log("🔵 Status:", monriRes.status);

    if (!monriData?.client_secret) {
      console.error("❌ Monri did not return client_secret:", monriData);
      return res.status(500).json({ message: "Failed to create Monri session" });
    }

    res.json({ client_secret: monriData.client_secret });

  } catch (err) {
    console.error("❌ Backend crash:", err);
    res.status(500).json({ message: err.message || "Payment init failed" });
  }
});
