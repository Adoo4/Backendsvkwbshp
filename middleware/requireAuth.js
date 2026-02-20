const { clerk } = require("../index");
const User = require("../models/user");

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.replace("Bearer ", "");

    // ✅ Correct verification for JWT template tokens
    const payload = await clerk.verifyToken(token);

    if (!payload) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const clerkUser = await clerk.users.getUser(payload.sub);

    const email =
      clerkUser.emailAddresses.find((e) => e.primary)?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      "";

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
    req.user = user;

    next();
  } catch (err) {const { clerk } = require("../index");
const User = require("../models/user");

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.replace("Bearer ", "");
    const { claims } = await clerk.jwt.verify(token, { template: "backend" });

    if (!claims) return res.status(401).json({ message: "Invalid token" });

    const clerkUser = await clerk.users.getUser(claims.sub);

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
    console.error("Auth middleware error:", err);
    res.status(401).json({ message: "Unauthorized" });
  }
};