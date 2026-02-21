const express = require("express");
const mongoose = require("mongoose");
const TempOrder = require("../models/tempOrder");
const Cart = require("../models/cart");
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");
const { calculatePrice } = require("../utils/priceUtils");

const router = express.Router();

router.post("/create-temp", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { shipping, paymentOption, orderNumber } = req.body;

    if (!shipping || !shipping.deliveryMethod) {
      return res.status(400).json({ message: "Shipping information required" });
    }

    // 1️⃣ Get user's cart (Clerk-based)
    const cart = await Cart.findOne({ userId: clerkId }).populate({
      path: "items.book",
      select: "title quantity mpc discount",
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let cartTotal = 0;
    const items = [];

    for (const item of cart.items) {
      const book = item.book;
      if (!book) continue;

      // Stock validation
      if (item.quantity > book.quantity) {
        return res.status(400).json({
          message: `Only ${book.quantity} available for ${book.title}`,
        });
      }

      const { mpc, discountedPrice, discountAmount } =
        calculatePrice(book.mpc, book.discount);

      const itemTotal = Number((discountedPrice * item.quantity).toFixed(2));
      cartTotal += itemTotal;

      items.push({
        book: book._id,
        quantity: item.quantity,
        priceAtPurchase: discountedPrice,
      });
    }

    cartTotal = Number(cartTotal.toFixed(2));

    if (cartTotal <= 0) {
      return res.status(400).json({ message: "Invalid cart total" });
    }

    // 2️⃣ Delivery calculation
    const deliveryPrices = {
      bhposta: 7,
      brzaposta: 10,
      storepickup: 0,
    };

    const deliveryMethod = shipping.deliveryMethod;

    if (!deliveryPrices[deliveryMethod]) {
      return res.status(400).json({ message: "Invalid delivery method" });
    }

    const deliveryPrice = deliveryPrices[deliveryMethod];
    const totalAmount = Number((cartTotal + deliveryPrice).toFixed(2));

    // 3️⃣ Create new temp order
    const tempOrder = await TempOrder.create({
      clerkId,
      items,
      cartTotal,
      delivery: {
        method: deliveryMethod,
        price: deliveryPrice,
      },
      totalAmount,
      status: "pending",
      shipping,
      paymentMethod: paymentOption,
      paymentId: orderNumber,
    });

    return res.status(201).json({
      message: "Temporary order created",
      orderId: tempOrder._id,
      totalAmount,
    });

  } catch (err) {
    console.error("CREATE TEMP ORDER ERROR:", err);
    return res.status(500).json({
      message: "Failed to create temporary order",
    });
  }
});

module.exports = router;