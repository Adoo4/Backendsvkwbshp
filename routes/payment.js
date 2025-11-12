const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const MONRI_AUTH_TOKEN = process.env.MONRI_AUTH_TOKEN; // authenticity token
const MONRI_KEY = process.env.MONRI_KEY;               // merchant key

const MONRI_RETURN_URL = process.env.MONRI_RETURN_URL || "https://svkbkstr.netlify.app/payment-success";
const MONRI_CANCEL_URL = process.env.MONRI_CANCEL_URL || "https://svkbkstr.netlify.app/payment-cancel";
const MONRI_CALLBACK_URL = process.env.MONRI_CALLBACK_URL || "https://yourbackend.com/api/payment/callback";

const MONRI_FORM_URL =
  process.env.NODE_ENV === "production"
    ? "https://ipg.monri.com/v2/form"
    : "https://ipgtest.monri.com/v2/form";



/**
 * STEP 2: Handle Monri callback (server-to-server notification)
 * Verify digest using WP3 standard: SHA512(MONRI_KEY + rawBody)
 */
router.post("/create-payment", (req, res) => {
  try {
    const { amount, currency, order_number } = req.body;

    const raw = MONRI_KEY + order_number + amount + currency;
    const digest = crypto.createHash("sha512").update(raw).digest("hex");

    res.json({
      authenticity_token: MONRI_AUTH_TOKEN,
      digest,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create payment digest" });
  }
});

{/*router.post("/create", requireAuth, async (req, res) => {
  try {
    // 1️⃣ Fetch user's cart with book details
    const cart = await Cart.findOne({ userId: req.userId }).populate("items.book");
    if (!cart || cart.items.length === 0) 
      return res.status(400).json({ message: "Cart is empty" });

    // 2️⃣ Calculate total with discounts
    const now = new Date();
    let total = 0;
    cart.items.forEach(item => {
      const bookPrice = item.book.price;
      const discount = (item.book.discount?.validUntil && new Date(item.book.discount.validUntil) > now)
        ? item.book.discount.amount
        : 0;
      total += (bookPrice - discount) * item.quantity;
    });

    // 3️⃣ Prepare Monri form data
    const { shipping } = req.body; // shipping info from frontend
    const orderNumber = Math.floor(Math.random() * 1000000).toString();
    const data = {
      authenticity_token: MONRI_AUTH_TOKEN,
      digest: MONRI_KEY,
      order_number: orderNumber,
      amount: total.toFixed(2),
      currency: "BAM",
      transaction_type: "purchase",
      order_info: `Order ${orderNumber}`,
      language: "ba-hr",
      ch_full_name: shipping.fullName || "",
      ch_address: shipping.address || "",
      ch_city: shipping.city || "",
      ch_zip: shipping.zip || "",
      ch_country: "BA",
      ch_phone: shipping.phone || "",
      ch_email: shipping.email || "",
      success_url_override: `${MONRI_RETURN_URL}?order_number=${orderNumber}`,
      cancel_url: MONRI_CANCEL_URL,
      callback_url: MONRI_CALLBACK_URL,
    };

    // 4️⃣ Send request to Monri
    const response = await axios.post("https://ipgtest.monri.com/v2/transaction", data);
    res.json(response.data);

  } catch (err) {
    console.error("Monri create error:", err.response?.data || err.message);
    res.status(500).json({ message: "Payment creation failed", error: err.message });
  }
}); */}

/**
 * STEP 3: Optional success redirect (frontend)
 */

router.post("/callback", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    // 1️⃣ Get raw body for digest validation
    const rawBody = req.body.toString();
    const digestHeader = req.headers["digest"];

    // 2️⃣ Validate Monri's digest
    const expectedDigest = crypto
      .createHash("sha512")
      .update(MONRI_KEY + rawBody)
      .digest("hex");

    if (expectedDigest !== digestHeader) {
      console.warn("❌ Invalid Monri callback digest!");
      return res.status(403).send("Invalid digest");
    }

    // 3️⃣ Parse Monri's payload
    const data = JSON.parse(rawBody);
    console.log("✅ Monri callback received:", data);

    const { order_number, response_code, response_message, amount, transaction_id } = data;

    // 4️⃣ Find the matching TempOrder
    const tempOrder = await TempOrder.findOne({ paymentId: order_number });

    if (!tempOrder) {
      console.warn(`⚠️ No TempOrder found for Monri order_number: ${order_number}`);
      return res.status(404).send("Order not found");
    }

    // 5️⃣ Update order based on payment result
    if (response_code === "0000") {
      tempOrder.status = "paid";
      tempOrder.paymentMethod = "card";
      tempOrder.paymentInfo = {
        transactionId: transaction_id,
        amount,
        currency: data.currency,
        response_message,
        paidAt: new Date(),
      };

      await tempOrder.save();
      console.log(`💰 Order ${order_number} marked as paid`);
    } else {
      tempOrder.status = "failed";
      tempOrder.paymentInfo = {
        response_message,
        failedAt: new Date(),
      };
      await tempOrder.save();
      console.log(`❗Order ${order_number} failed: ${response_message}`);
    }

    // 6️⃣ Always respond 200 OK to Monri
    res.status(200).send("OK");
  } catch (err) {
    console.error("⚠️ Monri callback error:", err);
    res.status(500).send("Error");
  }
});


router.get("/success", (req, res) => {
  const params = req.query;

  // You can optionally verify digest if Monri provides it in query
  // For now, just redirect to frontend success page
  res.redirect(`${MONRI_RETURN_URL}?status=success&order_number=${params.order_number}`);
});

module.exports = router;
