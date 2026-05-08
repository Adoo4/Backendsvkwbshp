// middleware/devAuth.js
const { clerkMiddleware, getAuth, requireAuth } = require("@clerk/express");

const devClerkMiddleware = process.env.DEV_CLERK_SECRET_KEY
  ? clerkMiddleware({ secretKey: process.env.DEV_CLERK_SECRET_KEY })
  : null;

function devAuth(req, res, next) {
  if (process.env.DEV_MODE === "true" && devClerkMiddleware) {
    return devClerkMiddleware(req, res, () => {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ message: "Dev auth failed" });
      return next();
    });
  }
  return requireAuth()(req, res, next);
}

module.exports = devAuth;