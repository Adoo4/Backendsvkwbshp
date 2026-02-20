// middleware/requireAuth.js
const { clerk } = require("../index"); // shared Clerk instance
const User = require("../models/user");

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization; // frontend sends "Bearer <token>"
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.replace("Bearer ", "");

    // Verify session with Clerk
    const session = await clerk.sessions.verifyToken(token);
    if (!session) return res.status(401).json({ message: "Invalid session" });

    const clerkUser = await clerk.users.getUser(session.user.id);

    // Get primary email
    const email =
      clerkUser.emailAddresses.find((e) => e.primary)?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      "";

    // Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { clerkId: clerkUser.id },
      {
        clerkId: clerkUser.id,
        email,
        name: clerkUser.firstName || "NoName",
      },
      { new: true, upsert: true }
    );

    req.userId = user._id;
    req.user = user; // optional: attach full user
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(401).json({ message: "Unauthorized" });
  }
};