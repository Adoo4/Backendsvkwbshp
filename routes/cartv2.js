// routes/cartv2.js
const express = require("express");
const mongoose = require("mongoose");
const { requireAuth, getAuth } = require("@clerk/express");

const Cart = require("../models/cart");
const Book = require("../models/book");
const { calculatePrice } = require("../utils/priceUtils");
const { getOnlineAvailableQuantity } = require("../utils/stockUtils");

const router = express.Router();

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

/** Build the full cart response shape from a populated cart document */
function buildCartResponse(cartItems) {
  const now = new Date();

  const result = cartItems.reduce(
    (acc, item) => {
      if (!item.book) return acc;

      const { mpc, discountedPrice, discountAmount } = calculatePrice(
        item.book.mpc,
        item.book.discount,
        now
      );

      const onlineQuantity = getOnlineAvailableQuantity(item.book.quantity);
      const itemTotal = Number((discountedPrice * item.quantity).toFixed(2));

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
            validUntil: item.book.discount?.validUntil ?? null,
          },
        },
      });

      return acc;
    },
    { items: [], totalCart: 0 }
  );

  const delivery = result.totalCart >= 100 ? 0 : result.items.length ? 5 : 0;
  const totalWithDelivery = Number((result.totalCart + delivery).toFixed(2));

  return {
    items: result.items,
    totalCart: Number(result.totalCart.toFixed(2)),
    delivery,
    totalWithDelivery,
  };
}

/** Populate a cart document and return it as a plain object */
async function populateCart(userId) {
  return Cart.findOne({ userId })
    .populate({
      path: "items.book",
      select:
        "title author mpc coverImage discount format isbn pages slug subCategory quantity language year publisher isNew",
    })
    .lean();
}

/** Validate that bookId is a proper ObjectId */
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/* ─────────────────────────────────────────────
   GET CART
   Public-ish: guests get empty cart, auth users get theirs
───────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req); // null when guest

    const empty = { items: [], totalCart: 0, delivery: 0, totalWithDelivery: 0 };

    if (!userId) return res.json(empty);

    const cart = await populateCart(userId);
    if (!cart || !cart.items.length) return res.json(empty);

    return res.json(buildCartResponse(cart.items));
  } catch (err) {
    console.error("GET CART ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch cart" });
  }
});

/* ─────────────────────────────────────────────
   ADD TO CART   (auth required)
───────────────────────────────────────────── */
router.post("/", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId, quantity = 1 } = req.body;

    if (!isValidId(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    if (!Number.isInteger(quantity) || quantity <= 0)
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
    return res.status(201).json({ message: "Added to cart" });
  } catch (err) {
    console.error("ADD CART ERROR:", err);
    return res.status(500).json({ message: "Failed to add to cart" });
  }
});

/* ─────────────────────────────────────────────
   MERGE GUEST CART ON LOGIN   (auth required)
   Body: { items: [{ bookId: string, quantity: number }] }
   Strategy: guest quantity is ADDED to any existing server quantity,
             clamped to the available online stock.
───────────────────────────────────────────── */
router.post("/merge", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "No items to merge" });

    // Upsert the cart document so we always have one to work with
    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, items: [] } },
      { new: true, upsert: true }
    );

    // Collect unique, valid bookIds so we can batch-fetch books
    const validItems = items.filter(
      ({ bookId, quantity }) =>
        isValidId(bookId) && Number.isInteger(quantity) && quantity > 0
    );

    if (validItems.length === 0) {
      return res.json({ message: "No valid items to merge", merged: 0 });
    }

    const bookIds = [...new Set(validItems.map((i) => i.bookId))];
    const books = await Book.find({ _id: { $in: bookIds } })
      .select("quantity")
      .lean();

    const stockMap = Object.fromEntries(
      books.map((b) => [b._id.toString(), getOnlineAvailableQuantity(b.quantity)])
    );

    let merged = 0;

    for (const { bookId, quantity } of validItems) {
      const onlineAvailable = stockMap[bookId];

      // Skip books not found or completely unavailable
      if (onlineAvailable === undefined || onlineAvailable === 0) continue;

      const existing = cart.items.find((i) => i.book.toString() === bookId);
      const combined = (existing?.quantity ?? 0) + quantity;
      const clamped = Math.min(combined, onlineAvailable);

      if (clamped <= 0) continue;

      if (existing) {
        existing.quantity = clamped;
      } else {
        cart.items.push({ book: bookId, quantity: clamped });
      }

      merged++;
    }

    await cart.save();
    return res.json({ message: "Cart merged", merged });
  } catch (err) {
    console.error("MERGE CART ERROR:", err);
    return res.status(500).json({ message: "Failed to merge cart" });
  }
});

/* ─────────────────────────────────────────────
   UPDATE QUANTITY   (auth required)
───────────────────────────────────────────── */
router.patch("/", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId, quantity } = req.body;

    if (!isValidId(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    if (!Number.isInteger(quantity) || quantity <= 0)
      return res.status(400).json({ message: "Quantity must be a positive integer" });

    const book = await Book.findById(bookId).lean();
    if (!book) return res.status(404).json({ message: "Book not found" });

    const onlineAvailable = getOnlineAvailableQuantity(book.quantity);

    if (quantity > onlineAvailable)
      return res.status(400).json({
        message: `Only ${onlineAvailable} cop${onlineAvailable === 1 ? "y" : "ies"} available online`,
      });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find((i) => i.book.toString() === bookId);
    if (!item) return res.status(404).json({ message: "Item not in cart" });

    item.quantity = quantity;
    await cart.save();

    return res.json({ message: "Cart updated" });
  } catch (err) {
    console.error("UPDATE CART ERROR:", err);
    return res.status(500).json({ message: "Failed to update cart" });
  }
});

/* ─────────────────────────────────────────────
   REMOVE SINGLE ITEM   (auth required)
   NOTE: must be defined before DELETE "/" to avoid Express
   matching "/:bookId" with an empty param.
───────────────────────────────────────────── */
router.delete("/:bookId", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { bookId } = req.params;

    if (!isValidId(bookId))
      return res.status(400).json({ message: "Invalid book ID" });

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { book: new mongoose.Types.ObjectId(bookId) } } },
      { new: true }
    );

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    return res.json({ message: "Item removed" });
  } catch (err) {
    console.error("REMOVE CART ITEM ERROR:", err);
    return res.status(500).json({ message: "Failed to remove item" });
  }
});

/* ─────────────────────────────────────────────
   CLEAR CART   (auth required)
───────────────────────────────────────────── */
router.delete("/", requireAuth(), async (req, res) => {
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