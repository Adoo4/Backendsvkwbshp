const express = require("express");
const Cart = require("../models/cart");
const Book = require("../models/book");
const requireAuth = require("../middleware/requireAuth");
const { calculateCartTotals } = require("../utils/calculate");

const router = express.Router();

// GET user's cart

// GET user's cart with secure price calculation
// GET user's cart with secure backend price calculation
router.get("/", requireAuth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId }).populate({
      path: "items.book",
      model: "Book",
      select: "title author price coverImage discount format isbn pages",
      match: { _id: { $ne: null } },
    });

    if (!cart) {
      return res.json({ items: [], totalCart: 0, totalWithDelivery: 0 });
    }

    const { detailedItems, totalCart, delivery, totalWithDelivery } =
      calculateCartTotals(cart.items);

    res.json({
      items: detailedItems,
      totalCart,
      delivery,
      totalWithDelivery,
    });
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ message: "Error fetching cart" });
  }
});

{
  /*router.get("/", requireAuth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId }).populate("items.book");
    if (!cart) return res.json({ items: [] });
    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching cart" });
  }
});*/
}

// ADD to cart
router.post("/", requireAuth, async (req, res) => {
  try {
    const { bookId, quantity = 1 } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    let cart = await Cart.findOne({ userId: req.userId });

    if (!cart) {
      cart = new Cart({
        userId: req.userId,
        items: [{ book: bookId, quantity }],
      });
    } else {
      const idx = cart.items.findIndex((i) => i.book.toString() === bookId);
      if (idx > -1) cart.items[idx].quantity += quantity;
      else cart.items.push({ book: bookId, quantity });
    }

    await cart.save();
    await cart.populate("items.book");

    const { detailedItems, totalCart, delivery, totalWithDelivery } =
      calculateCartTotals(cart.items);

    res.status(201).json({
      items: detailedItems,
      totalCart,
      delivery,
      totalWithDelivery,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding to cart" });
  }
});

// UPDATE quantity
router.patch("/", requireAuth, async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const idx = cart.items.findIndex((i) => i.book.toString() === bookId);
    if (idx === -1)
      return res.status(404).json({ message: "Item not in cart" });

    cart.items[idx].quantity = quantity;
    await cart.save();
    await cart.populate("items.book");

    const { detailedItems, totalCart, delivery, totalWithDelivery } =
      calculateCartTotals(cart.items);

    res.json({
      items: detailedItems,
      totalCart,
      delivery,
      totalWithDelivery,
    });
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
      (i) => i.book.toString() !== req.params.bookId
    );
    await cart.save();
    await cart.populate("items.book");

    const { detailedItems, totalCart, delivery, totalWithDelivery } =
      calculateCartTotals(cart.items);

    res.json({
      items: detailedItems,
      totalCart,
      delivery,
      totalWithDelivery,
    });
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

// CART CALCULATE

router.post("/calculate", async (req, res) => {
  try {
    const { items, deliveryMethod } = req.body;

    // Fetch book details for each item
    const populatedItems = await Promise.all(
      items.map(async (item) => {
        const book = await Book.findById(item.book);
        return { book, quantity: item.quantity };
      })
    );

    const { totalCart, delivery, totalWithDelivery } = calculateCartTotals(
      populatedItems,
      deliveryMethod
    );

    res.json({
      totalBooksPrice: totalCart.toFixed(2),
      deliveryPrice: delivery.toFixed(2),
      totalWithDelivery: totalWithDelivery.toFixed(2),
    });
  } catch (error) {
    console.error("Error calculating totals:", error);
    res.status(500).json({ message: "Calculation failed" });
  }
});

module.exports = router;
