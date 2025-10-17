{/*const express = require("express");
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

    const order_number = Date.now().toString();
    const amountStr = amount.toString(); // ✅ ensure STRING

    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + order_number + amountStr + currency)
      .digest("hex");

    res.json({
      authenticity_token: MONRI_AUTH_TOKEN,
      order_number,
      amount: amountStr,
      currency,
      digest,
      customer,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment init failed" });
  }
});

router.post("/payment-complete", (req, res) => {
  console.log("Payment-complete full body:", req.body);
  res.send("Payment processed successfully");
});

module.exports = router;
*/}

const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // public / slave token
const MONRI_KEY = process.env.MONRI_KEY;             // private key / master key for digest
const SUCCESS_URL = process.env.MONRI_SUCCESS_URL;   // e.g., https://yourdomain.com/success
const CANCEL_URL = process.env.MONRI_CANCEL_URL;     // e.g., https://yourdomain.com/cancel
const CALLBACK_URL = process.env.MONRI_CALLBACK_URL; // e.g., https://yourdomain.com/callback

// Create a payment request for Monri WebPay Form
router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer, order_info } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ message: "Missing amount or currency" });
    }

    // Generate a unique order number
    const order_number = Date.now().toString();

    // Amount in minor units (e.g., cents)
    const amountStr = amount.toString();

    // Digest formula: SHA512(MONRI_KEY + order_number + amount + currency)
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + order_number + amountStr + currency)
      .digest("hex");

    // Optional: fields config to lock email and full name
    const custom_attributes = JSON.stringify({
      fields_config: {
        fields: [
          { name: "ch_email", readonly: true },
          { name: "ch_full_name", readonly: true }
        ]
      }
    });

    // Return all parameters for front-end to build POST form
    res.json({
      authenticity_token: MONRI_AUTH_TOKEN,
      order_number,
      amount: amountStr,
      currency,
      digest,
      transaction_type: "purchase", // or "authorize"
      customer_name: customer?.full_name || "",
      customer_email: customer?.email || "",
      order_info: order_info || "Purchase from your store",
      success_url_override: SUCCESS_URL,
      cancel_url_override: CANCEL_URL,
      callback_url_override: CALLBACK_URL,
      custom_attributes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment init failed" });
  }
});

module.exports = router;


