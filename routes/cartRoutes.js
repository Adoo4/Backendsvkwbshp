const express = require("express");
const Cart = require("../models/cart");
const Book = require("../models/book");
const requireAuth = require("../middleware/requireAuth");
const { calculatePrice } = require("../utils/priceUtils");

const router = express.Router();

// GET user's cart with secure backend price calculation


router.get("/", requireAuth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId })
      .populate({
        path: "items.book",
        model: "Book",
        select: "title author price coverImage discount format isbn pages",
      });

    if (!cart) {
      return res.json({ items: [], totalCart: 0, delivery: 0, totalWithDelivery: 0 });
    }

    const now = new Date();
    const VAT_RATE = 0.17;

    const { items, totalCart } = cart.items.reduce(
      (acc, item) => {
        const book = item.book;
        if (!book) return acc;

        const { priceWithVAT, discountedPrice, discountAmount } = calculatePrice(book.price, book.discount, VAT_RATE, now);
        const itemTotal = Number((discountedPrice * item.quantity).toFixed(2));
        acc.totalCart += itemTotal;

        acc.items.push({
          _id: item._id,
          quantity: item.quantity,
          itemTotal,
          book: {
            _id: book._id,
            title: book.title,
            author: book.author,
            price: book.price,
            priceWithVAT,
            discountedPrice,
            discount: {
              amount: discountAmount,
              validUntil: book.discount?.validUntil,
            },
            coverImage: book.coverImage,
            format: book.format,
            isbn: book.isbn,
            pages: book.pages,
          },
        });

        return acc;
      },
      { items: [], totalCart: 0 }
    );

    const delivery = totalCart >= 100 ? 0 : 5;
    const totalWithDelivery = Number((totalCart + delivery).toFixed(2));

    res.json({ items, totalCart: Number(totalCart.toFixed(2)), delivery, totalWithDelivery });
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ message: "Error fetching cart" });
  }
});



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
      const idx = cart.items.findIndex(i => i.book.toString() === bookId);
      if (idx > -1) cart.items[idx].quantity += quantity;
      else cart.items.push({ book: bookId, quantity });
    }

    await cart.save();
    await cart.populate("items.book");
    res.status(201).json(cart);
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

    const idx = cart.items.findIndex(i => i.book.toString() === bookId);
    if (idx === -1) return res.status(404).json({ message: "Item not in cart" });

    cart.items[idx].quantity = quantity;
    await cart.save();
    await cart.populate("items.book");
    res.json(cart);
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

    cart.items = cart.items.filter(i => i.book.toString() !== req.params.bookId);
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
