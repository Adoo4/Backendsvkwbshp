const express = require("express");
const Cart = require("../models/cart");
const Book = require("../models/book");
const withUserId = require("../middleware/requireAuth"); // middleware function

const router = express.Router();

// GET user's cart
router.get("/", withUserId, async (req, res) => {
  const cart = await Cart.findOne({ user: req.userId }).populate("items.book");
  if (!cart) return res.json({ items: [] });
  res.json(cart);
});

// ADD to cart
router.post("/", withUserId, async (req, res) => {
  const { bookId, quantity = 1 } = req.body;
  const book = await Book.findById(bookId);
  if (!book) return res.status(404).json({ message: "Book not found" });

  let cart = await Cart.findOne({ user: req.userId });
  if (!cart) {
    cart = new Cart({ user: req.userId, items: [{ book: bookId, quantity }] });
  } else {
    const idx = cart.items.findIndex(i => i.book.toString() === bookId);
    if (idx > -1) cart.items[idx].quantity += quantity;
    else cart.items.push({ book: bookId, quantity });
  }

  await cart.save();
  await cart.populate("items.book");
  res.status(201).json(cart);
});

// UPDATE quantity
router.patch("/", withUserId, async (req, res) => {
  const { bookId, quantity } = req.body;
  const cart = await Cart.findOne({ user: req.userId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const idx = cart.items.findIndex(i => i.book.toString() === bookId);
  if (idx === -1) return res.status(404).json({ message: "Item not in cart" });

  cart.items[idx].quantity = quantity;
  await cart.save();
  await cart.populate("items.book");
  res.json(cart);
});

// REMOVE item
router.delete("/:bookId", withUserId, async (req, res) => {
  const cart = await Cart.findOne({ user: req.userId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  cart.items = cart.items.filter(i => i.book.toString() !== req.params.bookId);
  await cart.save();
  await cart.populate("items.book");
  res.json(cart);
});

// CLEAR cart
router.delete("/", withUserId, async (req, res) => {
  await Cart.findOneAndDelete({ user: req.userId });
  res.json({ message: "Cart cleared" });
});

module.exports = router;
