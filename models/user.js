const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    email: { type: String },
    name: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    wishlist: { type: mongoose.Schema.Types.ObjectId, ref: "Wishlist" }, // ovo može ostati
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);