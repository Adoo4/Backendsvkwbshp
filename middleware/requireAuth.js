// middleware/requireAuth.js
const { Clerk } = require("@clerk/clerk-sdk-node");
const User = require("../models/user");

// MUST be sk_live_… key
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization; // "Bearer <token>"
    if (!authHeader)
      return res.status(401).json({ message: "No token provided" });

    const token = authHeader.replace("Bearer ", "");

    // ✅ verify session token
    const session = await clerk.sessions.verifyToken(token);

    if (!session || !session.userId)
      return res.status(401).json({ message: "Invalid token" });

    // fetch user
    const clerkUser = await clerk.users.getUser(session.userId);

    const email =
      clerkUser.emailAddresses.find((e) => e.primary)?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      "";

    const user = await User.findOneAndUpdate(
      { clerkId: clerkUser.id },
      { clerkId: clerkUser.id, email, name: clerkUser.firstName || "NoName" },
      { new: true, upsert: true }
    );

    req.userId = user._id;
    req.user = user;

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(401).json({ message: "Unauthorized" });
  }
};
