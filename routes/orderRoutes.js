const express = require("express");
const Order = require("../models/order");
const Cart = require("../models/cart");
const User = require("../models/user");
const requireAuth = require("../middleware/requireAuth"); // array

const router = express.Router();

// CREATE order from cart
// POST /api/orders/create-temp
// POST /api/orders/create-temp
router.post("/create-temp", requireAuth, async (req, res) => {
  try {
    const { shipping, deliveryOption, paymentOption, orderNumber } = req.body;
    const user = await User.findOne({ clerkId: req.auth.userId });
    const cart = await Cart.findOne({ user: user._id }).populate("items.book");

    if (!cart || cart.items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    // calculate totals (you can reuse your backend total logic for consistency)
    const items = cart.items.map((i) => ({
      book: i.book._id,
      quantity: i.quantity,
      priceAtPurchase: i.book.price,
    }));

    const totalAmount = items.reduce(
      (sum, i) => sum + i.quantity * i.priceAtPurchase,
      0
    );

    const order = await Order.create({
      user: user._id,
      clerkId: req.auth.userId,
      items,
      totalAmount,
      status: "pending",
      shipping,
      paymentMethod: paymentOption,
      paymentId: orderNumber, // same as used for Monri
    });

    res.json({
      message: "Temporary order created",
      orderNumber,
      totalAmount,
      orderId: order._id,
    });
  } catch (err) {
    console.error("❌ Error creating temp order:", err);
    res.status(500).json({ message: "Failed to create temporary order" });
  }
});



// GET user orders
router.get("/", requireAuth, async (req, res) => {
  const user = await User.findOne({ clerkId: req.auth.userId });
  const orders = await Order.find({ user: user._id }).populate("items.book");
  res.json(orders);
});

module.exports = router;

