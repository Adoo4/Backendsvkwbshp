// New file — guest variant of /api/monri-components/create-payment-session.
// Existing routes/monriComponents.js is untouched; this one skips Clerk auth and
// uses the orderId itself as the unguessable identifier for the temp order.

const express = require("express");
const crypto = require("crypto");
const TempOrder = require("../models/tempOrder");

const router = express.Router();

const MONRI_KEY = process.env.MONRI_KEY;
const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN;
const MONRI_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://ipg.monri.com"
    : "https://ipgtest.monri.com";

router.post("/create-payment-session", async (req, res) => {
  try {
    if (!MONRI_KEY || !MONRI_AUTH_TOKEN) {
      console.error("Guest Monri: MONRI_KEY or MONRI_AUTH_TOKEN missing");
      return res.status(500).json({ message: "Payment provider not configured" });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const tempOrder = await TempOrder.findById(orderId);
    if (!tempOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Only proceed for guest orders. Authenticated orders must use /api/monri-components.
    if (!String(tempOrder.clerkId).startsWith("guest:")) {
      return res.status(403).json({ message: "Authenticated orders use a different endpoint" });
    }
    if (tempOrder.status !== "pending") {
      return res.status(400).json({ message: "Order is no longer pending" });
    }

    const amountMinorUnits = Math.round(Number(tempOrder.totalAmount) * 100);
    const orderNumber = String(tempOrder._id);
    const orderInfo = `Narudzba ${orderNumber}`.slice(0, 100);

    const requestBody = {
      amount: amountMinorUnits,
      order_number: orderNumber,
      currency: "BAM",
      transaction_type: "purchase",
      order_info: orderInfo,
      scenario: "charge",
    };

    const bodyAsString = JSON.stringify(requestBody);
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + timestamp + MONRI_AUTH_TOKEN + bodyAsString)
      .digest("hex");

    const authorization = `WP3-v2 ${MONRI_AUTH_TOKEN} ${timestamp} ${digest}`;

    const monriRes = await fetch(`${MONRI_BASE_URL}/v2/payment/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: bodyAsString,
    });

    if (!monriRes.ok) {
      const errorText = await monriRes.text();
      console.error("Guest Monri /v2/payment/new failed:", monriRes.status, errorText);
      return res.status(502).json({ message: "Failed to create payment session with Monri" });
    }

    const data = await monriRes.json();
    if (!data.client_secret) {
      console.error("Guest Monri response missing client_secret:", data);
      return res.status(502).json({ message: "Invalid response from Monri" });
    }

    tempOrder.paymentId = String(data.id);
    await tempOrder.save();

    return res.json({
      clientSecret: data.client_secret,
      paymentId: data.id,
      authenticityToken: MONRI_AUTH_TOKEN,
    });
  } catch (err) {
    console.error("Guest create payment session error:", err);
    return res.status(500).json({ message: "Failed to create payment session" });
  }
});

module.exports = router;
