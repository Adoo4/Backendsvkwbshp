const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// ✅ Replace with real credentials from Monri dashboard
const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // data-authenticity-token
const MONRI_KEY = process.env.MONRI_KEY; // key for digest

router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ message: "Missing amount or currency" });
    }

    const order_number = Date.now().toString(); // Unique per transaction

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
  console.log("✅ Monri callback received:", req.body);
  res.sendStatus(200);
});

module.exports = router;
