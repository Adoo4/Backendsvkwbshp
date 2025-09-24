const express = require("express");
const Order = require("../models/order");
const Cart = require("../models/cart");
const User = require("../models/user");
const requireAuth = require("../middleware/requireAuth"); // array

const router = express.Router();

// CREATE order from cart
router.post("/", requireAuth, async (req, res) => {
  const user = await User.findOne({ clerkId: req.auth.userId });
  const cart = await Cart.findOne({ user: user._id }).populate("items.book");
  if (!cart || cart.items.length === 0) return res.status(400).json({ message: "Cart is empty" });

  const items = cart.items.map(i => ({
    book: i.book._id,
    quantity: i.quantity,
    priceAtPurchase: i.book.price,
  }));
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.priceAtPurchase, 0);

  const order = await Order.create({ user: user._id, items, totalAmount });
  await Cart.findOneAndDelete({ user: user._id }); // clear cart

  res.status(201).json(order);
});

// GET user orders
router.get("/", requireAuth, async (req, res) => {
  const user = await User.findOne({ clerkId: req.auth.userId });
  const orders = await Order.find({ user: user._id }).populate("items.book");
  res.json(orders);
});

module.exports = router;

