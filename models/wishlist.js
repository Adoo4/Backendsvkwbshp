// models/Wishlist.js
const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",      // reference to User schema
      required: true,
      unique: true,     // each user has one wishlist
    },
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",    // reference to Book schema
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
