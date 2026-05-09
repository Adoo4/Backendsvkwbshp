// middleware/devAuth.js
const { clerkMiddleware, getAuth, requireAuth } = require("@clerk/express");

// In DEV_MODE the frontend is using the dev Clerk instance, so we need to pass
// BOTH secretKey and publishableKey here — otherwise clerkMiddleware falls back
// to CLERK_PUBLISHABLE_KEY (the live one) and the issuer check rejects the token.
const devClerkMiddleware =
  process.env.DEV_CLERK_SECRET_KEY && process.env.DEV_CLERK_PUBLISHABLE_KEY
    ? clerkMiddleware({
        secretKey: process.env.DEV_CLERK_SECRET_KEY,
        publishableKey: process.env.DEV_CLERK_PUBLISHABLE_KEY,
      })
    : null;

function devAuth(req, res, next) {
  if (process.env.DEV_MODE === "true" && devClerkMiddleware) {
    return devClerkMiddleware(req, res, (err) => {
      if (err) {
        console.error("DEV AUTH MIDDLEWARE ERROR:", err);
        return res.status(401).json({ message: "Dev auth failed", error: err.message });
      }
      const { userId } = getAuth(req);
      if (!userId) {
        return res.status(401).json({ message: "Dev auth failed: no userId" });
      }
      return next();
    });
  }
  return requireAuth()(req, res, next);
}

module.exports = devAuth;