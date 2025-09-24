const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    clerkId: { 
      type: String, 
      required: true, 
      unique: true 
    }, // Clerk user ID

    email: { type: String },
    name: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
    wishlist: { type: mongoose.Schema.Types.ObjectId, ref: "Wishlist" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
