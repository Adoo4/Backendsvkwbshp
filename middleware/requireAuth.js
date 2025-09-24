const { requireAuth } = require("@clerk/express");
const User = require("../models/user");

module.exports = [
  requireAuth(), // Clerk JWT provjera
  async (req, res, next) => {
    try {
      // provjera da li postoji Mongo user sa clerkId
      let user = await User.findOne({ clerkId: req.auth.userId });

      if (!user) {
        // ako ne postoji, kreiraj novog korisnika
        user = new User({
          clerkId: req.auth.userId,
          email: req.auth.sessionClaims.email_addresses?.[0]?.email_address || "",
          name: req.auth.sessionClaims.first_name || "NoName",
        });
        await user.save();
        console.log("Created new Mongo user for Clerk:", user._id);
      }

      req.userId = user._id; // attach Mongo ID
      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      res.status(500).json({ message: "Authentication error" });
    }
  },
];
