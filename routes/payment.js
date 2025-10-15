const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN;
const MONRI_KEY = process.env.MONRI_KEY;

router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ message: "Missing amount or currency" });
    }

    const order_number = Date.now().toString(); // Unique per transaction

    // Digest calculation
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + order_number + amount + currency)
      .digest("hex");

    res.json({
      authenticity_token: MONRI_AUTH_TOKEN,
      order_number,
      amount,
      currency,
      digest,
      customer,
    });
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
