const { Clerk } = require("@clerk/clerk-sdk-node");
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });
const User = require("../models/user");

module.exports = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkUser = await clerk.users.getUser(req.auth.userId);

      const email =
        clerkUser.emailAddresses.find(e => e.primary)?.emailAddress ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        "";

      // upsert user
      const user = await User.findOneAndUpdate(
        { clerkId: clerkUser.id },
        {
          clerkId: clerkUser.id,
          email,
          name: clerkUser.firstName || "NoName",
        },
        { new: true, upsert: true } // create if not exist
      );

      req.userId = user._id;
      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      res.status(500).json({ message: "Authentication error" });
    }
  },
];

