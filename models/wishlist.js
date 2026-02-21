const mongoose = require("mongoose");

const WishlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }],
});

module.exports = mongoose.model("Wishlist", WishlistSchema);