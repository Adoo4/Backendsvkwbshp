// routes/wishlistRoutes.js

const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("@clerk/express");

const Wishlist = require("../models/wishlist");
const Book = require("../models/book");
const { calculatePrice } = require("../utils/priceUtils");
const { getOnlineAvailableQuantity } = require("../utils/stockUtils");

const router = express.Router();

// ✅ Protect ALL routes in this router
router.use(requireAuth());

/* =====================================
   GET WISHLIST
===================================== */
router.get("/", async (req, res) => {
  try {
    const userId = req.auth.userId;

    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "items",
      select: "title author mpc discount coverImage slug quantity",
    });

    if (!wishlist) return res.json({ items: [] });

    const now = new Date();

    const itemsWithPrices = wishlist.items.map((book) => {
      const { mpc, discountedPrice, discountAmount } =
        calculatePrice(book.mpc, book.discount, now);

      const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

      return {
        ...book.toObject(),
        mpc,
        discountedPrice,
        discountAmount,
        onlineQuantity,
        isAvailableOnline: onlineQuantity > 0,
      };
    });

    res.json({ items: itemsWithPrices });
  } catch (err) {
    console.error("GET WISHLIST ERROR:", err);
    res.status(500).json({ message: "Error fetching wishlist" });
  }
});

/* =====================================
   ADD TO WISHLIST
===================================== */
router.post("/", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    const book = await Book.findById(bookId);
    if (!book)
      return res.status(404).json({ message: "Book not found" });

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [bookId] });
    } else {
      if (wishlist.items.includes(bookId))
        return res.status(400).json({ message: "Already in wishlist" });

      wishlist.items.push(bookId);
    }

    await wishlist.save();

    await wishlist.populate({
      path: "items",
      select: "title author mpc discount coverImage slug quantity",
    });

    const now = new Date();

    const itemsWithPrices = wishlist.items.map((book) => {
      const { mpc, discountedPrice, discountAmount } =
        calculatePrice(book.mpc, book.discount, now);

      const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

      return {
        ...book.toObject(),
        mpc,
        discountedPrice,
        discountAmount,
        onlineQuantity,
        isAvailableOnline: onlineQuantity > 0,
      };
    });

    res.status(201).json({ items: itemsWithPrices });
  } catch (err) {
    console.error("ADD WISHLIST ERROR:", err);
    res.status(500).json({ message: "Error adding to wishlist" });
  }
});

/* =====================================
   REMOVE FROM WISHLIST
===================================== */
router.delete("/:bookId", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist)
      return res.status(404).json({ message: "Wishlist not found" });

    wishlist.items = wishlist.items.filter(
      (b) => b.toString() !== bookId
    );

    await wishlist.save();

    await wishlist.populate({
      path: "items",
      select: "title author mpc discount coverImage slug quantity",
    });

    const now = new Date();

    const itemsWithPrices = wishlist.items.map((book) => {
      const { mpc, discountedPrice, discountAmount } =
        calculatePrice(book.mpc, book.discount, now);

      const onlineQuantity = getOnlineAvailableQuantity(book.quantity);

      return {
        ...book.toObject(),
        mpc,
        discountedPrice,
        discountAmount,
        onlineQuantity,
        isAvailableOnline: onlineQuantity > 0,
      };
    });

    res.json({ items: itemsWithPrices });
  } catch (err) {
    console.error("REMOVE WISHLIST ERROR:", err);
    res.status(500).json({ message: "Error removing item" });
  }
});

/* =====================================
   CLEAR WISHLIST
===================================== */
router.delete("/", async (req, res) => {
  try {
    const userId = req.auth.userId;

    await Wishlist.findOneAndDelete({ userId });

    res.json({ message: "Wishlist cleared", items: [] });
  } catch (err) {
    console.error("CLEAR WISHLIST ERROR:", err);
    res.status(500).json({ message: "Error clearing wishlist" });
  }
});

module.exports = router;