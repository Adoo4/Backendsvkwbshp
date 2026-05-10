// New file — guest checkout (no Clerk auth required).
// Mirrors orderRoutes.js logic but accepts items[] in request body since guests
// have no persistent cart on the server. Existing routes/orderRoutes.js is untouched.

const express = require("express");
const TempOrder = require("../models/tempOrder");
const Book = require("../models/book");
const { calculatePrice } = require("../utils/priceUtils");

const router = express.Router();

const DELIVERY_PRICES = {
  bhposta: 8,
  brzaposta: 10,
  storepickup: 0,
};

// Cart totals at or above this threshold qualify for free delivery on any method.
// Must stay in sync with frontend (app/checkout/page.tsx) and cart route (cartv2.js).
const FREE_SHIPPING_THRESHOLD = 100;

// Guest orders share the TempOrder collection with auth orders.
// We tag them with a "guest:" prefix on clerkId so existing webhooks/admin
// queries can distinguish them without schema changes.
function makeGuestId(email) {
  const safe = String(email || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._@-]/g, "")
    .slice(0, 60);
  return `guest:${safe}:${Date.now()}`;
}

router.post("/create-temp", async (req, res) => {
  try {
    const { shipping, paymentOption, items } = req.body;

    // ── Basic validation ──
    if (!shipping || typeof shipping !== "object") {
      return res.status(400).json({ message: "Shipping information required" });
    }
    if (!shipping.deliveryMethod) {
      return res.status(400).json({ message: "Delivery method required" });
    }
    if (!shipping.email || !shipping.fullName || !shipping.phone || !shipping.address || !shipping.city || !shipping.zip) {
      return res.status(400).json({ message: "All shipping fields are required" });
    }
    if (!paymentOption || !["card", "cash", "bank"].includes(paymentOption)) {
      return res.status(400).json({ message: "Invalid payment option" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items required" });
    }

    // ── Resolve books + validate stock + compute totals server-side ──
    const bookIds = items.map((i) => i.bookId);
    const books = await Book.find({ _id: { $in: bookIds } }).lean();
    const bookMap = new Map(books.map((b) => [String(b._id), b]));

    let cartTotal = 0;
    const orderItems = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ message: "Invalid item quantity" });
      }

      const book = bookMap.get(String(item.bookId));
      if (!book) {
        return res.status(400).json({ message: `Knjiga nije pronađena: ${item.bookId}` });
      }
      if (qty > book.quantity) {
        return res.status(400).json({
          message: `Nedovoljno na zalihi za "${book.title}" — dostupno: ${book.quantity}`,
        });
      }

      const { discountedPrice } = calculatePrice(book.mpc, book.discount, new Date());
      const itemTotal = Number((discountedPrice * qty).toFixed(2));
      cartTotal += itemTotal;

      orderItems.push({
        book: book._id,
        quantity: qty,
        priceAtPurchase: discountedPrice,
      });
    }

    cartTotal = Number(cartTotal.toFixed(2));
    if (cartTotal <= 0) {
      return res.status(400).json({ message: "Invalid cart total" });
    }

    // ── Delivery ──
    const deliveryMethod = shipping.deliveryMethod;
    if (!Object.prototype.hasOwnProperty.call(DELIVERY_PRICES, deliveryMethod)) {
      return res.status(400).json({ message: "Invalid delivery method" });
    }
    const deliveryPrice =
      cartTotal >= FREE_SHIPPING_THRESHOLD ? 0 : DELIVERY_PRICES[deliveryMethod];
    const totalAmount = Number((cartTotal + deliveryPrice).toFixed(2));

    // ── Persist temp order ──
    const tempOrder = await TempOrder.create({
      clerkId: makeGuestId(shipping.email),
      items: orderItems,
      cartTotal,
      delivery: {
        method: deliveryMethod,
        price: deliveryPrice,
      },
      totalAmount,
      status: "pending",
      shipping: {
        fullName: shipping.fullName,
        email: shipping.email,
        phone: shipping.phone,
        address: shipping.address,
        city: shipping.city,
        zip: shipping.zip,
      },
      paymentMethod: paymentOption,
    });

    return res.status(201).json({
      message: "Guest temp order created",
      orderId: tempOrder._id,
      totalAmount,
    });
  } catch (err) {
    console.error("Guest create-temp error:", err);
    return res.status(500).json({ message: "Failed to create guest order" });
  }
});

module.exports = router;
