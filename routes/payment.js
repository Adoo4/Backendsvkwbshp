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

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN;
const MONRI_KEY = process.env.MONRI_KEY;

router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, customer } = req.body;
    if (!amount || !currency) {
      return res.status(400).json({ message: "Missing amount or currency" });
    }

    const order_number = Date.now().toString();
    const amountStr = amount.toString();
    const order_info = `Order #${order_number}`; // ✅ at least 3 chars

    // ✅ include order_info in digest
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + order_number + amountStr + currency + order_info)
      .digest("hex");

    res.json({
      authenticity_token: MONRI_AUTH_TOKEN,
      order_number,
      amount: amountStr,
      currency,
      order_info,
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
