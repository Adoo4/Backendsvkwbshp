// middleware/clerkAuth.js
const { requireAuth } = require("@clerk/express");
const { User } = require("../models/user"); // your Mongoose User model

/**
 * Custom middleware to sync Clerk user to MongoDB
 * Must be used AFTER clerkExpressWithAuth()
 */
const clerkAuthWithMongo = () => {
  return [
    requireAuth(), // ensures user is authenticated
    async (req, res, next) => {
      try {
        const clerkUserId = req.auth.userId;
        if (!clerkUserId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Fetch Clerk user data from Clerk API
        const { Clerk } = require("@clerk/clerk-sdk-node");
        const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
        const clerkUser = await clerk.users.getUser(clerkUserId);

        const email =
          clerkUser.emailAddresses.find((e) => e.primary)?.emailAddress ||
          clerkUser.emailAddresses[0]?.emailAddress ||
          "";

        // Upsert MongoDB user
        const user = await User.findOneAndUpdate(
          { clerkId: clerkUser.id },
          {
            clerkId: clerkUser.id,
            email,
            name: clerkUser.firstName || "NoName",
          },
          { new: true, upsert: true }
        );

        req.user = user;
        next();
      } catch (err) {
        console.error("Clerk Auth Error:", err);
        return res.status(401).json({ message: "Unauthorized" });
      }
    },
  ];
};

module.exports = clerkAuthWithMongo;