const mongoose = require("mongoose");

const tempOrderSchema = new mongoose.Schema(
  {
    // Clerk user ID only
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
        default: 0,
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "cancelled", "expired"],
      default: "pending",
      index: true,
    },

    shipping: {
      fullName: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      zip: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },

    paymentMethod: {
      type: String,
      enum: ["card", "cash", "bank"],
    },

    paymentId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TempOrder", tempOrderSchema);