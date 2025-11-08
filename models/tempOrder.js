const mongoose = require("mongoose");

const TempOrderSchema = new mongoose.Schema(
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
    status: { type: String, default: "pending" },
    shipping: {
      fullName: String,
      address: String,
      city: String,
      zip: String,
      email: String,
      phone: String,
      deliveryMethod: String,
    },
    paymentMethod: { type: String },
    paymentId: { type: String }, // order number or payment ID
  },
  { timestamps: true }
);

module.exports = mongoose.model("TempOrder", TempOrderSchema);
