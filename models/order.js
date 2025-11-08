const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clerkId: { type: String, required: true },

    items: [
      {
        book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
        quantity: { type: Number, required: true },
        priceAtPurchase: { type: Number, required: true },
      },
    ],

    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },

    // 🧭 Shipping & delivery
    shipping: {
      fullName: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      zip: String,
      deliveryMethod: String, // e.g. bhposta, euroexpress, storepickup
    },

    // 💳 Payment
    paymentMethod: {
      type: String,
      enum: ["card", "cash", "bank"],
    },
    paymentId: String, // Monri order_number or reference

    // Optional Monri data
    monriResponse: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
