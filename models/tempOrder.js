const mongoose = require("mongoose");

const TempOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    clerkId: {
      type: String,
      required: true,
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
        },
        priceAtPurchase: {
          type: Number,
          required: true,
        },
      },
    ],

    // 🔹 NEW: cart total (without delivery)
    cartTotal: {
      type: Number,
      required: true,
    },

    // 🔹 NEW: delivery breakdown
    delivery: {
      method: {
        type: String,
        enum: ["bhposta", "brzaposta", "storepickup"],
        required: true,
      },
      price: {
        type: Number,
        required: true,
        default: 0,
      },
    },

    // 🔹 FINAL total (cart + delivery)
    totalAmount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      default: "pending",
      enum: ["pending", "paid", "cancelled"],
    },

    // keep shipping address details
    shipping: {
      fullName: String,
      address: String,
      city: String,
      zip: String,
      email: String,
      phone: String,
    },

    paymentMethod: {
      type: String,
    },

    paymentId: {
      type: String, // order number or payment ID
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TempOrder", TempOrderSchema);

