const express = require("express");
const TempOrder = require("../models/tempOrder");
const User = require("../models/user");
const requireAuth = require("../middleware/requireAuth");
const Cart = require("../models/cart");
const { calculatePrice } = require("../utils/priceUtils");

const router = express.Router();

router.post("/create-temp", requireAuth, async (req, res) => {
  try {
    const { shipping, paymentOption, orderNumber } = req.body;

    // 1️⃣ Get user
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (!user) return res.status(400).json({ message: "User not found" });

    // 2️⃣ Get user's cart from DB
    const cart = await Cart.findOne({ userId: user._id }).populate(
      "items.book",
    );
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    // 3️⃣ Map items and calculate total securely
    let cartTotal = 0;

    const items = cart.items.map((item) => {
  const book = item.book;
  if (!book) throw new Error(`Invalid book in cart: ${item._id}`);

  const { discountedPrice, priceWithVAT } = calculatePrice(book.price, book.discount);
  const itemTotal = Number((discountedPrice * item.quantity).toFixed(2));

  cartTotal += itemTotal;

  return {
    book: book._id,
    quantity: item.quantity,
    priceAtPurchase: discountedPrice,
    priceWithVAT,
  };
});


    cartTotal = Number(cartTotal.toFixed(2));

    const deliveryPrices = {
      bhposta: 4.5,
      brzaposta: 10,
      storepickup: 0,
    };

    const deliveryMethod = shipping.deliveryMethod;
    const deliveryPrice = deliveryPrices[deliveryMethod] ?? 0;

    if (!deliveryPrices.hasOwnProperty(deliveryMethod)) {
      return res.status(400).json({ message: "Invalid delivery method" });
    }

    // 2️⃣ Prevent negative totals (defensive)
    if (cartTotal < 0) {
      return res.status(400).json({ message: "Invalid cart total" });
    }

    // ✅ Calculate final total after validations
    const totalAmount = Number((cartTotal + deliveryPrice).toFixed(2));

    // 4️⃣ Check if temp order already exists
   // 4️⃣ Always create a new temp order for the user
const tempOrder = await TempOrder.create({
  user: user._id,
  clerkId: req.auth.userId,
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

// ✅ Send response
res.status(201).json({
  message: "Temporary order saved",
  orderId: tempOrder._id,
  orderNumber,
  cartTotal,
  deliveryPrice,
  totalAmount,
});

  } catch (err) {
    console.error("Error creating temp order:", err);
    res.status(500).json({
      message: "Failed to create temporary order",
      error: err.message,
    });
  }
});

module.exports = router;
