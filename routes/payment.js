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
import crypto from 'crypto';
import axios from 'axios';

const merchantKey = process.env.MONRI_KEY;
const authenticityToken = process.env.MONRI_AUTH_TOKEN;
const baseUrl = 'https://ipgtest.monri.com'; // Test env
const timestamp = Math.floor(Date.now() / 1000);

const data = {
  amount: 8200, // minor units, 82 BAM = 8200
  order_number: '1760745476195',
  currency: 'BAM',
  transaction_type: 'purchase',
  order_info: 'Order info example',
  scenario: 'charge',
};

const bodyAsString = JSON.stringify(data);

const digest = crypto
  .createHash('sha512')
  .update(merchantKey + timestamp + authenticityToken + bodyAsString)
  .digest('hex');

const authorizationHeader = `WP3-v2 ${authenticityToken} ${timestamp} ${digest}`;

const response = await axios.post(`${baseUrl}/v2/payment/new`, data, {
  headers: {
    'Content-Type': 'application/json',
    Authorization: authorizationHeader,
  },
});

console.log(response.data);