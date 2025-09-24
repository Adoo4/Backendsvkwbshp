// middleware/requireAuth.js
// middleware/requireAuth.js
const { requireAuth } = require("@clerk/express");
const User = require("../models/user");

module.exports = [
  requireAuth(),
  async (req, res, next) => {
    try {
      // find Mongo user linked with Clerk ID
      const user = await User.findOne({ clerkId: req.auth.userId });
      if (!user) {
        return res.status(401).json({ message: "User not found in DB" });
      }
      req.userId = user._id; // attach Mongo ID
      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      res.status(500).json({ message: "Authentication error" });
    }
  },
];