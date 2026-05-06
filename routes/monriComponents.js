// New route — kept separate from payment.js so existing redirect-based flow stays untouched.
// Implements Monri Components inline payment session creation.
// Docs: https://ipgtest.monri.com/en/documentation/components

const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("@clerk/express");
const TempOrder = require("../models/tempOrder");

const router = express.Router();

const MONRI_KEY = process.env.MONRI_KEY;
const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN;
const MONRI_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://ipg.monri.com"
    : "https://ipgtest.monri.com";

/**
 * POST /api/monri-components/create-payment-session
 * Body: { orderId: string }   // _id of an existing TempOrder belonging to the authenticated user
 * Returns: { clientSecret, paymentId, authenticityToken }
 *
 * Flow:
 *   1. Verify caller owns the temp order and it's pending.
 *   2. Build Monri /v2/payment/new request (WP3-v2 signed digest).
 *   3. Forward to Monri, return client_secret to the frontend.
 */
router.post("/create-payment-session", requireAuth(), async (req, res) => {
  try {
    if (!MONRI_KEY || !MONRI_AUTH_TOKEN) {
      console.error("Monri Components: MONRI_KEY or MONRI_AUTH_TOKEN missing");
      return res.status(500).json({ message: "Payment provider not configured" });
    }

    const userId = req.auth.userId;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    // 1. Look up TempOrder
    const tempOrder = await TempOrder.findOne({ _id: orderId, clerkId: userId });
    if (!tempOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (tempOrder.status !== "pending") {
      return res.status(400).json({ message: "Order is no longer pending" });
    }

    // 2. Build Monri request body
    const amountMinorUnits = Math.round(Number(tempOrder.totalAmount) * 100);
    const orderNumber = String(tempOrder._id);
    const orderInfo = `Narudzba ${orderNumber}`.slice(0, 100); // 3-100 chars

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

    // 3. Call Monri
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
      console.error("Monri /v2/payment/new failed:", monriRes.status, errorText);
      return res
        .status(502)
        .json({ message: "Failed to create payment session with Monri" });
    }

    const data = await monriRes.json();

    if (!data.client_secret) {
      console.error("Monri response missing client_secret:", data);
      return res
        .status(502)
        .json({ message: "Invalid response from Monri" });
    }

    // 4. Persist Monri payment id on temp order for later reconciliation in webhook.
    tempOrder.paymentId = String(data.id);
    await tempOrder.save();

    return res.json({
      clientSecret: data.client_secret,
      paymentId: data.id,
      authenticityToken: MONRI_AUTH_TOKEN,
    });
  } catch (err) {
    console.error("Create payment session error:", err);
    return res.status(500).json({ message: "Failed to create payment session" });
  }
});

module.exports = router;
