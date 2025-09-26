const express = require("express");
const Wishlist = require("../models/wishlist");
const Book = require("../models/book");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// GET user's wishlist
router.get("/", requireAuth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.userId }).populate("items");
    if (!wishlist) return res.json({ items: [] });
    res.json({ items: wishlist.items }); // 👈 only send items array
    //old   res.json(wishlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching wishlist" });
  }
});

// ADD to wishlist
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
    res.status(201).json(wishlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding to wishlist" });
  }
});

// REMOVE item from wishlist
router.delete("/:bookId", requireAuth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.userId });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

    wishlist.items = wishlist.items.filter(b => b.toString() !== req.params.bookId);
    await wishlist.save();
    await wishlist.populate("items");
    res.json(wishlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error removing item" });
  }
});

// CLEAR wishlist
router.delete("/", requireAuth, async (req, res) => {
  try {
    await Wishlist.findOneAndDelete({ userId: req.userId });
    res.json({ message: "Wishlist cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error clearing wishlist" });
  }
});

module.exports = router;
