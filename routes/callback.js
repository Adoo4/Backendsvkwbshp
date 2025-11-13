const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const TempOrder = require("../models/tempOrder");
const agenda = require("../utils/agenda");

const MONRI_KEY = process.env.MONRI_KEY; // merchant key  

router.post("/", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    console.log("🔔 Monri callback hit!");

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
      return res.status(403).send("Invalid digest");
    }

    // ✅ Verified callback
    const data = JSON.parse(rawBody);
    console.log("✅ Verified callback:", data);

    const { order_number, response_code, response_message } = data;

    const tempOrder = await TempOrder.findOne({ paymentId: order_number });
    if (!tempOrder) {
      console.warn(`⚠️ No TempOrder found for order_number: ${order_number}`);
      return res.status(404).send("Order not found");
    }

    // 🧾 Update order status
    if (response_code === "0000") {
      tempOrder.status = "paid";
      tempOrder.paymentInfo = { response_message, paidAt: new Date() };
      await tempOrder.save();

      // ✅ Queue email job with the full order object
      await agenda.now("send order emails", { tempOrder }); 
      // tempOrder contains full order details from MongoDB
    } else {
      tempOrder.status = "failed";
      tempOrder.paymentInfo = { response_message, failedAt: new Date() };
      await tempOrder.save();
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("⚠️ Monri callback error:", err);
    res.status(500).send("Error");
  }
});



module.exports = router;
