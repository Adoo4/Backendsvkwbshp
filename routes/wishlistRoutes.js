const express = require("express");
const Wishlist = require("../models/wishlist");
const Book = require("../models/book");
const withUserId = require("../middleware/requireAuth");

const router = express.Router();

// GET wishlist
router.get("/", withUserId, async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.userId }).populate("items");
  if (!wishlist) return res.json({ items: [] });
  res.json(wishlist);
});

// ADD to wishlist
router.post("/", withUserId, async (req, res) => {
  const { bookId } = req.body;
  const book = await Book.findById(bookId);
  if (!book) return res.status(404).json({ message: "Book not found" });

  let wishlist = await Wishlist.findOne({ user: req.userId });
  if (!wishlist) {
    wishlist = new Wishlist({ user: req.userId, items: [bookId] });
  } else {
    if (wishlist.items.includes(bookId)) {
      return res.status(400).json({ message: "Already in wishlist" });
    }
    wishlist.items.push(bookId);
  }

  await wishlist.save();
  await wishlist.populate("items");
  res.status(201).json(wishlist);
});

// REMOVE from wishlist
router.delete("/:bookId", withUserId, async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.userId });
  if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

  wishlist.items = wishlist.items.filter(b => b.toString() !== req.params.bookId);
  await wishlist.save();
  await wishlist.populate("items");
  res.json(wishlist);
});

// CLEAR wishlist
router.delete("/", withUserId, async (req, res) => {
  await Wishlist.findOneAndDelete({ user: req.userId });
  res.json({ message: "Wishlist cleared" });
});

module.exports = router;
