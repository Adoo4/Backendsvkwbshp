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
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const digest = crypto
      .createHash("sha512")
      .update(
        MONRI_KEY +
          timestamp +
          MONRI_AUTH_TOKEN +
          order_number +
          amount +
          currency
      )
      .digest("hex");

    res.json({
      authenticity_token: MONRI_AUTH_TOKEN,
      order_number,
      amount,
      currency,
      digest,
      timestamp,
      customer,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment init failed" });
  }
});


router.post("/payment-complete", (req, res) => {
  const transaction = req.body.transaction_response; // JSON string
  const data = JSON.parse(transaction);

  // Save to DB
  Transaction.create(data)
    .then(() => {
      res.send("Payment processed successfully");
    })
    .catch(err => {
      console.error(err);
      res.status(500).send("Error saving transaction");
    });
});


module.exports = router;
