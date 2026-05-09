// middleware/devAuth.js
const { requireAuth } = require("@clerk/express");
const { verifyToken } = require("@clerk/backend");

async function devAuth(req, res, next) {
  if (process.env.DEV_MODE === "true") {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) return res.status(401).json({ message: "No token" });

    try {
      const verified = await verifyToken(token, {
        secretKey: process.env.DEV_CLERK_SECRET_KEY,
      });
      req.auth = { userId: verified.sub };
      return next();
    } catch (err) {
      console.error("DEV AUTH ERROR:", err);
      return res.status(401).json({
        message: "Dev auth failed",
        error: err.message,
        reason: err.reason,
      });
    }
  }

  return requireAuth()(req, res, next);
}

module.exports = devAuth;