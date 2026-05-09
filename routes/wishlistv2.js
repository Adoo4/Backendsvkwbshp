// routes/wishlistRoutes.js
const express = require("express");
const mongoose = require("mongoose");

const Wishlist = require("../models/wishlist");
const Cart = require("../models/cart");
const Book = require("../models/book");
const { calculatePrice } = require("../utils/priceUtils");
const { getOnlineAvailableQuantity } = require("../utils/stockUtils");

const router = express.Router();

// NOTE: requireAuth() is applied in server.js via:
//   app.use("/api/wishlist", requireAuth(), wishlistRoutes)
// Do NOT add router.use(requireAuth()) here — that would run Clerk twice.

/* ─────────────────────────────────────────────
   SHARED HELPERS
───────────────────────────────────────────── */

const BOOK_SELECT =
  "title author mpc discount coverImage slug quantity";

/** Populate a wishlist document and return it as a plain object */
async function populateWishlist(userId) {
  return Wishlist.findOne({ userId })
    .populate({ path: "items", select: BOOK_SELECT })
    .lean();
}

/** Map raw book documents → response shape with live prices */
function buildItems(books) {
  const now = new Date();
  return books.map((book) => {
    const { mpc, discountedPrice, discountAmount } = calculatePrice(
      book.mpc,
      book.discount,
      now
    );
    const onlineQuantity = getOnlineAvailableQuantity(book.quantity);
    return {
      ...book,
      mpc,
      discountedPrice,
      discountAmount,
      onlineQuantity,
      isAvailableOnline: onlineQuantity > 0,
    };
  });
}

/** Validate ObjectId and send 400 if invalid */
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/* ─────────────────────────────────────────────
   GET  /api/wishlist
───────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const { userId } = req.auth;

    const wishlist = await populateWishlist(userId);
    if (!wishlist) return res.json({ items: [] });

    return res.json({ items: buildItems(wishlist.items) });
  } catch (err) {
    console.error("GET WISHLIST ERROR:", err);
    return res.status(500).json({ message: "Error fetching wishlist" });
  }
});

/* ─────────────────────────────────────────────
   POST  /api/wishlist
   Body: { bookId: string }
───────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const { userId } = req.auth;
    const { bookId } = req.body;

    if (!isValidId(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    // Verify book exists
    const bookExists = await Book.exists({ _id: bookId });
    if (!bookExists)
      return res.status(404).json({ message: "Book not found" });

    // Upsert wishlist; $addToSet is atomic and idempotent — no duplicate check needed
    const result = await Wishlist.findOneAndUpdate(
      { userId },
      { $addToSet: { items: new mongoose.Types.ObjectId(bookId) } },
      { upsert: true, new: true }
    ).populate({ path: "items", select: BOOK_SELECT }).lean();

    return res.status(201).json({ items: buildItems(result.items) });
  } catch (err) {
    console.error("ADD WISHLIST ERROR:", err);
    return res.status(500).json({ message: "Error adding to wishlist" });
  }
});

/* ─────────────────────────────────────────────
   DELETE  /api/wishlist          ← MUST be before /:bookId
   Clears entire wishlist
───────────────────────────────────────────── */
router.delete("/", async (req, res) => {
  try {
    const { userId } = req.auth;

    await Wishlist.deleteOne({ userId });

    return res.json({ items: [] });
  } catch (err) {
    console.error("CLEAR WISHLIST ERROR:", err);
    return res.status(500).json({ message: "Error clearing wishlist" });
  }
});

/* ─────────────────────────────────────────────
   POST  /api/wishlistv2/move-to-cart/:bookId
   Adds the book to the cart and removes it from the wishlist.
   Body: { quantity?: number }  // defaults to 1
   Returns: { items: [...] }   // updated wishlist
───────────────────────────────────────────── */
router.post("/move-to-cart/:bookId", async (req, res) => {
  try {
    const { userId } = req.auth;
    const { bookId } = req.params;
    const quantity = Number.isInteger(req.body?.quantity) ? req.body.quantity : 1;

    if (!isValidId(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    if (quantity <= 0)
      return res.status(400).json({ message: "Quantity must be a positive integer" });

    const book = await Book.findById(bookId).lean();
    if (!book) return res.status(404).json({ message: "Book not found" });

    const onlineAvailable = getOnlineAvailableQuantity(book.quantity);
    if (onlineAvailable === 0)
      return res.status(400).json({ message: "This book is not available for online purchase" });

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, items: [] } },
      { new: true, upsert: true }
    );

    const existing = cart.items.find((i) => i.book.toString() === bookId);
    const newQty = (existing?.quantity ?? 0) + quantity;

    if (newQty > onlineAvailable)
      return res.status(400).json({
        message: `Only ${onlineAvailable} cop${onlineAvailable === 1 ? "y" : "ies"} available online`,
      });

    if (existing) {
      existing.quantity = newQty;
    } else {
      cart.items.push({ book: bookId, quantity });
    }

    await cart.save();

    const updated = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { items: new mongoose.Types.ObjectId(bookId) } },
      { new: true }
    ).populate({ path: "items", select: BOOK_SELECT }).lean();

    return res.json({ items: updated ? buildItems(updated.items) : [] });
  } catch (err) {
    console.error("MOVE WISHLIST → CART ERROR:", err);
    return res.status(500).json({ message: "Failed to move item to cart" });
  }
});

/* ─────────────────────────────────────────────
   DELETE  /api/wishlist/:bookId
   Removes a single book
───────────────────────────────────────────── */
router.delete("/:bookId", async (req, res) => {
  try {
    const { userId } = req.auth;
    const { bookId } = req.params;

    if (!isValidId(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    // Atomic $pull — no fetch-filter-save round trip
    const result = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { items: new mongoose.Types.ObjectId(bookId) } },
      { new: true }
    ).populate({ path: "items", select: BOOK_SELECT }).lean();

    if (!result)
      return res.status(404).json({ message: "Wishlist not found" });

    return res.json({ items: buildItems(result.items) });
  } catch (err) {
    console.error("REMOVE WISHLIST ERROR:", err);
    return res.status(500).json({ message: "Error removing item" });
  }
});

module.exports = router;