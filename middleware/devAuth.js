// middleware/devAuth.js
const { createClerkClient } = require("@clerk/express");

const devClerk = createClerkClient({
  secretKey: process.env.DEV_CLERK_SECRET_KEY,
});

async function devAuth(req, res, next) {
  if (process.env.DEV_MODE === "true") {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ message: "No token" });

      const verified = await devClerk.verifyToken(token);
      req.auth = { userId: verified.sub };
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Dev auth failed", error: err.message });
    }
  }

  // Production — use normal Clerk
  return requireAuth()(req, res, next);
}

module.exports = devAuth;