// routes/cartRoutes.js
const express = require("express");
const Cart = require("../models/cart");
const Book = require("../models/book");
const { requireAuth } = require("@clerk/express"); // Clerk middleware
const clerkAuthWithMongo = require("../middleware/clerkAuth"); // syncs MongoDB user
const { calculatePrice } = require("../utils/priceUtils");
const { getOnlineAvailableQuantity } = require("../utils/stockUtils");

const router = express.Router();

/**
 * Helper function to format cart items with prices and stock info
 */
const formatCartItems = (cartItems) => {
  const now = new Date();
  let totalCart = 0;

  const items = cartItems.reduce((acc, item) => {
    const book = item.book;
    if (!book) return acc;

    const { mpc, discountedPrice, discountAmount } = calculatePrice(
      book.mpc,
      book.discount,
      now
    );

    const onlineQuantity = getOnlineAvailableQuantity(book.quantity);
    const itemTotal = Number((discountedPrice * item.quantity).toFixed(2));
    totalCart += itemTotal;

    acc.push({
      _id: item._id,
      quantity: item.quantity,
      itemTotal,
      book: {
        ...book.toObject(),
        onlineQuantity,
        isAvailableOnline: onlineQuantity > 0,
        mpc,
        discountedPrice,
        discount: {
          amount: discountAmount,
          validUntil: book.discount?.validUntil || null,
        },
      },
    });

    return acc;
  }, []);

  const delivery = totalCart >= 100 ? 0 : 5;
  const totalWithDelivery = Number((totalCart + delivery).toFixed(2));

  return {
    items,
    totalCart: Number(totalCart.toFixed(2)),
    delivery,
    totalWithDelivery,
  };
};

// ---------------- ROUTES ---------------- //

// GET /api/cart - Get user's cart
router.get(
  "/",
  requireAuth(),
  clerkAuthWithMongo(),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const cart = await Cart.findOne({ userId }).populate({
        path: "items.book",
        model: "Book",
        select:
          "title author mpc coverImage discount format isbn pages slug subCategory quantity",
      });

      if (!cart) {
        return res.json({
          items: [],
          totalCart: 0,
          delivery: 0,
          totalWithDelivery: 0,
        });
      }

      const formattedCart = formatCartItems(cart.items);
      res.json(formattedCart);
    } catch (err) {
      console.error("Error fetching cart:", err);
      res.status(500).json({ message: "Error fetching cart" });
    }
  }
);

// POST /api/cart - Add item to cart
router.post(
  "/",
  requireAuth(),
  clerkAuthWithMongo(),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const { bookId, quantity = 1 } = req.body;

      if (!bookId || quantity <= 0)
        return res.status(400).json({ message: "Invalid request" });

      const book = await Book.findById(bookId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      const onlineAvailable = getOnlineAvailableQuantity(book.quantity);

      let cart = await Cart.findOne({ userId });
      const existingQty =
        cart?.items.find((i) => i.book.toString() === bookId)?.quantity || 0;

      const requestedQty = existingQty + quantity;

      if (requestedQty > onlineAvailable)
        return res.status(400).json({
          message: `Only ${onlineAvailable} items available for online purchase`,
        });

      if (!cart) {
        cart = new Cart({
          userId,
          items: [{ book: bookId, quantity }],
        });
      } else {
        const idx = cart.items.findIndex((i) => i.book.toString() === bookId);
        if (idx > -1) {
          cart.items[idx].quantity = requestedQty;
        } else {
          cart.items.push({ book: bookId, quantity });
        }
      }

      await cart.save();
      res.status(201).json({ message: "Added to cart" });
    } catch (err) {
      console.error("Error adding to cart:", err);
      res.status(500).json({ message: "Error adding to cart" });
    }
  }
);

// PATCH /api/cart - Update quantity of an item
router.patch(
  "/",
  requireAuth(),
  clerkAuthWithMongo(),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const { bookId, quantity } = req.body;

      if (!bookId || quantity <= 0)
        return res.status(400).json({ message: "Invalid request" });

      const book = await Book.findById(bookId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      const onlineAvailable = getOnlineAvailableQuantity(book.quantity);
      if (quantity > onlineAvailable)
        return res.status(400).json({
          message: `Only ${onlineAvailable} items available for online purchase`,
        });

      const cart = await Cart.findOne({ userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      const idx = cart.items.findIndex((i) => i.book.toString() === bookId);
      if (idx === -1)
        return res.status(404).json({ message: "Item not in cart" });

      cart.items[idx].quantity = quantity;
      await cart.save();
      res.json({ message: "Cart updated" });
    } catch (err) {
      console.error("Error updating cart:", err);
      res.status(500).json({ message: "Error updating cart" });
    }
  }
);

// DELETE /api/cart/:bookId - Remove a single item
router.delete(
  "/:bookId",
  requireAuth(),
  clerkAuthWithMongo(),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const cart = await Cart.findOne({ userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      cart.items = cart.items.filter(
        (i) => i.book.toString() !== req.params.bookId
      );
      await cart.save();
      await cart.populate("items.book");

      res.json(cart);
    } catch (err) {
      console.error("Error removing item from cart:", err);
      res.status(500).json({ message: "Error removing item" });
    }
  }
);

// DELETE /api/cart - Clear cart
router.delete(
  "/",
  requireAuth(),
  clerkAuthWithMongo(),
  async (req, res) => {
    try {
      const userId = req.user._id;
      await Cart.findOneAndDelete({ userId });
      res.json({ message: "Cart cleared" });
    } catch (err) {
      console.error("Error clearing cart:", err);
      res.status(500).json({ message: "Error clearing cart" });
    }
  }
);

module.exports = router;