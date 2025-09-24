// middleware/requireAuth.js
const { requireAuth } = require("@clerk/express");

module.exports = [
  requireAuth(), // Clerk auth middleware
  (req, res, next) => {
    req.userId = req.auth.userId; // attach userId for your routes
    next();
  },
];