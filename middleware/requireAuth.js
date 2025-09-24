// middleware/requireAuth.js
const { requireAuth } = require("@clerk/express");
module.exports = requireAuth();