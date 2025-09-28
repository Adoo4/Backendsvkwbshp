const { Clerk } = require("@clerk/clerk-sdk-node");
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });

module.exports = [
  requireAuth(), // Clerk JWT provjera
  async (req, res, next) => {
    try {
      // Try to find Mongo user
      let user = await User.findOne({ clerkId: req.auth.userId });

      if (!user) {
        // Fetch full Clerk user
        const clerkUser = await clerk.users.getUser(req.auth.userId);

        user = new User({
          clerkId: clerkUser.id,
          email: clerkUser.emailAddresses.find(e => e.primary)?.emailAddress || "",
          name: clerkUser.firstName || "NoName",
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
