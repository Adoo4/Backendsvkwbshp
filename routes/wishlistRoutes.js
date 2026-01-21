const express = require("express");
const Wishlist = require("../models/wishlist");
const Book = require("../models/book");
const requireAuth = require("../middleware/requireAuth");
const { calculatePrice } = require("../utils/priceUtils");

const router = express.Router();

// GET user's wishlist with prices calculated
router.get("/", requireAuth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.userId }).populate("items");

    if (!wishlist) return res.json({ items: [] });

    // Apply price calculation to each book
    const itemsWithPrices = wishlist.items.map((book) => {
      const { priceWithVAT, discountedPrice, discountAmount } = calculatePrice(
        book.price,
        book.discount
      );
      return {
        ...book.toObject(),
        priceWithVAT,
        discountedPrice,
        discountAmount,
      };
    });

    res.json({ items: itemsWithPrices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching wishlist" });
  }
});

// ADD to wishlist and return updated wishlist with prices
router.post("/", requireAuth, async (req, res) => {
  try {
    const { bookId } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    let wishlist = await Wishlist.findOne({ userId: req.userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId: req.userId, items: [bookId] });
    } else {
      if (wishlist.items.includes(bookId)) {
        return res.status(400).json({ message: "Already in wishlist" });
      }
      wishlist.items.push(bookId);
    }

    await wishlist.save();
    await wishlist.populate("items");

    const itemsWithPrices = wishlist.items.map((book) => {
      const { priceWithVAT, discountedPrice, discountAmount } = calculatePrice(
        book.price,
        book.discount
      );
      return {
        ...book.toObject(),
        priceWithVAT,
        discountedPrice,
        discountAmount,
      };
    });

    res.status(201).json({ items: itemsWithPrices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding to wishlist" });
  }
});

// REMOVE item from wishlist and return updated wishlist with prices
router.delete("/:bookId", requireAuth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.userId });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

    wishlist.items = wishlist.items.filter(b => b.toString() !== req.params.bookId);
    await wishlist.save();
    await wishlist.populate("items");

    const itemsWithPrices = wishlist.items.map((book) => {
      const { priceWithVAT, discountedPrice, discountAmount } = calculatePrice(
        book.price,
        book.discount
      );
      return {
        ...book.toObject(),
        priceWithVAT,
        discountedPrice,
        discountAmount,
      };
    });

    res.json({ items: itemsWithPrices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error removing item" });
  }
});

// CLEAR wishlist
router.delete("/", requireAuth, async (req, res) => {
  try {
    await Wishlist.findOneAndDelete({ userId: req.userId });
    res.json({ message: "Wishlist cleared", items: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error clearing wishlist" });
  }
});

module.exports = router;
