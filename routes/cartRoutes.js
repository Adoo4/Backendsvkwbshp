const express = require("express");
const Cart = require("../models/cart");
const Book = require("../models/book");
const requireAuth = require("../middleware/requireAuth");
const { calculatePrice } = require("../utils/priceUtils");

const router = express.Router();

// GET user's cart with secure backend price calculation

router.get("/", requireAuth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId }).populate({
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

    const now = new Date();

    const { items, totalCart } = cart.items.reduce(
      (acc, item) => {
        const book = item.book;
        if (!book) return acc;

        const { mpc, discountedPrice, discountAmount } = calculatePrice(
          book.mpc,
          book.discount,
          now,
        );

        const itemTotal = Number((discountedPrice * item.quantity).toFixed(2));

        acc.totalCart += itemTotal;

        acc.items.push({
          _id: item._id,
          quantity: item.quantity,
          itemTotal,
          book: {
            ...book.toObject(),
            mpc,
            discountedPrice,
            discount: {
              amount: discountAmount,
              validUntil: book.discount?.validUntil || null,
            },
          },
        });

        return acc;
      },
      { items: [], totalCart: 0 },
    );

    const delivery = totalCart >= 100 ? 0 : 5;
    const totalWithDelivery = Number((totalCart + delivery).toFixed(2));

    res.json({
      items,
      totalCart: Number(totalCart.toFixed(2)),
      delivery,
      totalWithDelivery,
    });
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ message: "Error fetching cart" });
  }
});

// ADD to cart
router.post("/", requireAuth, async (req, res) => {
  try {
    const { bookId, quantity = 1 } = req.body;

    if (quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    let cart = await Cart.findOne({ userId: req.userId });

    const existingQty =
      cart?.items.find((i) => i.book.toString() === bookId)?.quantity || 0;

    const requestedQty = existingQty + quantity;

    if (requestedQty > book.quantity) {
      return res.status(400).json({
        message: `Only ${book.quantity} items available in stock`,
      });
    }

    if (!cart) {
      cart = new Cart({
        userId: req.userId,
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
    console.error(err);
    res.status(500).json({ message: "Error adding to cart" });
  }
});

// UPDATE quantity
router.patch("/", requireAuth, async (req, res) => {
  try {
    const { bookId, quantity } = req.body;

    if (quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (quantity > book.quantity) {
      return res.status(400).json({
        message: `Only ${book.quantity} items left in stock`,
      });
    }

    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const idx = cart.items.findIndex((i) => i.book.toString() === bookId);
    if (idx === -1) {
      return res.status(404).json({ message: "Item not in cart" });
    }

    cart.items[idx].quantity = quantity;
    await cart.save();

    res.json({ message: "Cart updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating cart" });
  }
});

// REMOVE item
router.delete("/:bookId", requireAuth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter(
      (i) => i.book.toString() !== req.params.bookId,
    );
    await cart.save();
    await cart.populate("items.book");
    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error removing item" });
  }
});

// CLEAR cart
router.delete("/", requireAuth, async (req, res) => {
  try {
    await Cart.findOneAndDelete({ userId: req.userId });
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error clearing cart" });
  }
});

module.exports = router;
