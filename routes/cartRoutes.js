// routes/cartRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("@clerk/express");

const Cart = require("../models/cart");
const Book = require("../models/book");
const { calculatePrice } = require("../utils/priceUtils");
const { getOnlineAvailableQuantity } = require("../utils/stockUtils");

const router = express.Router();

// ✅ Protect ALL routes in this file
router.use(requireAuth());

/* ================================
   GET CART
================================ */
router.get("/", async (req, res) => {
  try {
    const userId = req.auth.userId;

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.book",
        select:
          "title author mpc coverImage discount format isbn pages slug subCategory quantity",
      })
      .lean();

    if (!cart || !cart.items.length) {
      return res.json({
        items: [],
        totalCart: 0,
        delivery: 0,
        totalWithDelivery: 0,
      });
    }

    const now = new Date();

    const result = cart.items.reduce(
      (acc, item) => {
        if (!item.book) return acc;

        const { mpc, discountedPrice, discountAmount } =
          calculatePrice(item.book.mpc, item.book.discount, now);

        const onlineQuantity = getOnlineAvailableQuantity(item.book.quantity);
        const itemTotal = Number(
          (discountedPrice * item.quantity).toFixed(2)
        );

        acc.totalCart += itemTotal;

        acc.items.push({
          _id: item._id,
          quantity: item.quantity,
          itemTotal,
          book: {
            ...item.book,
            onlineQuantity,
            isAvailableOnline: onlineQuantity > 0,
            mpc,
            discountedPrice,
            discount: {
              amount: discountAmount,
              validUntil: item.book.discount?.validUntil || null,
            },
          },
        });

        return acc;
      },
      { items: [], totalCart: 0 }
    );

    const delivery = result.totalCart >= 100 ? 0 : 5;
    const totalWithDelivery = Number(
      (result.totalCart + delivery).toFixed(2)
    );

    return res.json({
      items: result.items,
      totalCart: Number(result.totalCart.toFixed(2)),
      delivery,
      totalWithDelivery,
    });
  } catch (err) {
    console.error("GET CART ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch cart" });
  }
});

/* ================================
   ADD TO CART
================================ */
router.post("/", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId, quantity = 1 } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    if (!Number.isInteger(quantity) || quantity <= 0)
      return res.status(400).json({ message: "Invalid quantity" });

    const book = await Book.findById(bookId).lean();
    if (!book) return res.status(404).json({ message: "Book not found" });

    const onlineAvailable = getOnlineAvailableQuantity(book.quantity);

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, items: [] } },
      { new: true, upsert: true }
    );

    const existingItem = cart.items.find(
      (i) => i.book.toString() === bookId
    );

    const newQty = (existingItem?.quantity || 0) + quantity;

    if (newQty > onlineAvailable)
      return res.status(400).json({
        message: `Only ${onlineAvailable} items available for online purchase`,
      });

    if (existingItem) {
      existingItem.quantity = newQty;
    } else {
      cart.items.push({ book: bookId, quantity });
    }

    await cart.save();
    return res.status(201).json({ message: "Added to cart" });
  } catch (err) {
    console.error("ADD CART ERROR:", err);
    return res.status(500).json({ message: "Failed to add to cart" });
  }
});

/* ================================
   UPDATE QUANTITY
================================ */
router.patch("/", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    if (!Number.isInteger(quantity) || quantity <= 0)
      return res.status(400).json({ message: "Invalid quantity" });

    const book = await Book.findById(bookId).lean();
    if (!book) return res.status(404).json({ message: "Book not found" });

    const onlineAvailable = getOnlineAvailableQuantity(book.quantity);

    if (quantity > onlineAvailable)
      return res
        .status(400)
        .json({ message: `Only ${onlineAvailable} items available` });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find(
      (i) => i.book.toString() === bookId
    );
    if (!item)
      return res.status(404).json({ message: "Item not in cart" });

    item.quantity = quantity;
    await cart.save();

    return res.json({ message: "Cart updated" });
  } catch (err) {
    console.error("UPDATE CART ERROR:", err);
    return res.status(500).json({ message: "Failed to update cart" });
  }
});

/* ================================
   REMOVE ITEM
================================ */
router.delete("/:bookId", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { book: bookId } } },
      { new: true }
    );

    if (!cart)
      return res.status(404).json({ message: "Cart not found" });

    return res.json({ message: "Item removed" });
  } catch (err) {
    console.error("REMOVE CART ITEM ERROR:", err);
    return res.status(500).json({ message: "Failed to remove item" });
  }
});

/* ================================
   CLEAR CART
================================ */
router.delete("/", async (req, res) => {
  try {
    const userId = req.auth.userId;

    await Cart.deleteOne({ userId });

    return res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error("CLEAR CART ERROR:", err);
    return res.status(500).json({ message: "Failed to clear cart" });
  }
});

module.exports = router;