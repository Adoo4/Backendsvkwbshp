const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // 🔐 Clerk user ID only
    clerkId: {
      type: String,
      required: true,
      index: true,
    },

    items: [
      {
        book: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Book",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        priceAtPurchase: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    cartTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    delivery: {
      method: {
        type: String,
        enum: ["bhposta", "brzaposta", "storepickup"],
        required: true,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },

    // 📦 Shipping info (required for paid orders)
    shipping: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      zip: { type: String, required: true },
    },

    // 💳 Payment
    paymentMethod: {
      type: String,
      enum: ["card", "cash", "bank"],
      required: true,
    },

    paymentId: {
      type: String,
      index: true,
    },

    // Store minimal provider metadata only
    paymentProvider: {
      type: String,
      enum: ["monri", "stripe", "manual"],
    },

    providerResponse: {
      type: mongoose.Schema.Types.Mixed, // safer than raw Object
      select: false, // don't return in normal queries
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);