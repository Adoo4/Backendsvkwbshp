const express = require("express");
const TempOrder = require("../models/tempOrder");
const User = require("../models/user");
const requireAuth = require("../middleware/requireAuth");
const Cart = require("../models/cart");

const router = express.Router();

router.post("/create-temp", requireAuth, async (req, res) => {
  try {
    const { shipping, paymentOption, orderNumber } = req.body;

    // 1️⃣ Get user
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (!user) return res.status(400).json({ message: "User not found" });

    // 2️⃣ Get user's cart from DB
    const cart = await Cart.findOne({ userId: user._id }).populate(
      "items.book"
    );
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    // 3️⃣ Map items and calculate total securely
    let cartTotal = 0;

    const items = cart.items.map((item) => {
      const book = item.book;
      if (!book) throw new Error("Invalid book in cart");

      let discountedPrice = book.price;
      const now = new Date();

      if (book.discount?.amount && book.discount?.validUntil) {
        if (new Date(book.discount.validUntil) >= now) {
          discountedPrice = book.price * (1 - book.discount.amount / 100);
        }
      }

      discountedPrice = Number(discountedPrice.toFixed(2));
      const itemTotal = Number((discountedPrice * item.quantity).toFixed(2));

      cartTotal += itemTotal;

      return {
        book: book._id,
        quantity: item.quantity,
        priceAtPurchase: discountedPrice,
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

    // 4️⃣ Check if temp order already exists
    let tempOrder = await TempOrder.findOne({
      user: user._id,
      status: "pending",
    });

    if (tempOrder) {
      tempOrder.items = items;
      tempOrder.cartTotal = cartTotal;
      tempOrder.delivery = {
        method: deliveryMethod,
        price: deliveryPrice,
      };
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
    }

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
