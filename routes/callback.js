// routes/monriCallback.js
const express = require("express");
const crypto = require("crypto");
const TempOrder = require("../models/tempOrder");

const router = express.Router();
const MONRI_KEY = process.env.MONRI_KEY;

// 🧩 Only this router uses express.raw to capture the raw Monri payload
router.post("/", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    console.log("🔔 Monri callback hit!");
    console.log("Headers:", req.headers);

    const rawBody = req.body.toString("utf-8");

    const authHeader =
      req.headers["authorization"] || req.headers["http_authorization"];
    const receivedDigest = authHeader?.replace("WP3-callback ", "").trim();

    const expectedDigest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + rawBody)
      .digest("hex");

    if (expectedDigest !== receivedDigest) {
      console.warn("❌ Invalid Monri callback digest!");
      console.log("Expected:", expectedDigest);
      console.log("Received:", receivedDigest);
      console.log("Raw body used for digest:", rawBody);
      return res.status(403).send("Invalid digest");
    }

    // ✅ Safe to parse now
    const data = JSON.parse(rawBody);
    console.log("✅ Verified callback:", data);

    const { order_number, response_code, response_message } = data;
    const tempOrder = await TempOrder.findOne({ paymentId: order_number });

    if (!tempOrder) {
      console.warn(`⚠️ No TempOrder found for order_number: ${order_number}`);
      return res.status(404).send("Order not found");
    }

    if (response_code === "0000") {
      tempOrder.status = "paid";
      tempOrder.paymentInfo = { response_message, paidAt: new Date() };
    } else {
      tempOrder.status = "failed";
      tempOrder.paymentInfo = { response_message, failedAt: new Date() };
    }

    await tempOrder.save();
    res.status(200).send("OK");
  } catch (err) {
    console.error("⚠️ Monri callback error:", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
