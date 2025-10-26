const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // e.g. key-xxxxxx
const MONRI_KEY = process.env.MONRI_KEY;               // your private key
const MONRI_BASE_URL = "https://ipgtest.monri.com";    // test environment
const SUCCESS_URL = "http://localhost:3000/success";   // or your deployed frontend
const CANCEL_URL = "http://localhost:3000/cancel";

router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ message: "Missing amount or currency" });
    }

    const order_number = Date.now().toString();
    const timestamp = Math.floor(Date.now() / 1000);

    // Prepare data for Monri request
    const data = {
      amount,
      order_number,
      currency,
      transaction_type: "purchase",
      order_info: "Bookstore order",
      scenario: "charge",
      return_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      customer_email: customer?.ch_email || "guest@test.com",
      customer_full_name: customer?.ch_full_name || "Guest User",
    };

    // Create digest according to Monri spec
    const bodyAsString = JSON.stringify(data);
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + timestamp + MONRI_AUTH_TOKEN + bodyAsString)
      .digest("hex");

    const authorization = `WP3-v2 ${MONRI_AUTH_TOKEN} ${timestamp} ${digest}`;

    // Send request to Monri
    const response = await axios.post(`${MONRI_BASE_URL}/v2/payment/new`, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
    });

    console.log("Monri response:", response.data);

    // Send the redirect URL back to the frontend
    res.json(response.data);
  } catch (err) {
    console.error("Error creating payment:", err.response?.data || err.message);
    res.status(500).json({ message: "Payment init failed" });
  }
});

// Optional callback route (Monri server → your server after payment)
router.post("/callback", (req, res) => {
  console.log("Callback body:", req.body);
  res.status(200).send("OK");
});

module.exports = router;
