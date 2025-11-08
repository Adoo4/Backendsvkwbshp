const express = require("express");
const TempOrder = require("../models/tempOrder"); // make sure this model exists
const User = require("../models/user");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// CREATE temporary order from frontend cart
router.post("/create-temp", requireAuth, async (req, res) => {
  try {
    const { cart: frontendCart, shipping, paymentOption, orderNumber } = req.body;

    // 1️⃣ Get user from Clerk
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (!user) return res.status(400).json({ message: "User not found" });

    // 2️⃣ Validate frontend cart items and calculate total
    if (!frontendCart || frontendCart.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Map items and ensure prices are correct
    const items = frontendCart.map((item) => {
      if (!item.book || !item.book._id || !item.book.price) {
        throw new Error("Invalid cart item");
      }
      return {
        book: item.book._id,
        quantity: item.quantity,
        priceAtPurchase: item.book.price, // secure: use DB price if needed
      };
    });

    const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.priceAtPurchase, 0);

    // 3️⃣ Check if temp order already exists
    let tempOrder = await TempOrder.findOne({ user: user._id, status: "pending" });

    if (tempOrder) {
      tempOrder.items = items;
      tempOrder.totalAmount = totalAmount;
      tempOrder.shipping = shipping;
      tempOrder.paymentMethod = paymentOption;
      tempOrder.paymentId = orderNumber;
      await tempOrder.save();
    } else {
      tempOrder = await TempOrder.create({
        user: user._id,
        clerkId: req.auth.userId,
        items,
        totalAmount,
        status: "pending",
        shipping,
        paymentMethod: paymentOption,
        paymentId: orderNumber,
      });
    }

    res.status(201).json({
      message: "Temporary order saved",
      orderId: tempOrder._id,
      orderNumber,
      totalAmount,
    });
  } catch (err) {
    console.error("Error creating temp order:", err);
    res.status(500).json({ message: "Failed to create temporary order", error: err.message });
  }
});

module.exports = router;
