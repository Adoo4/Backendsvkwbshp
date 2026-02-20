// middleware/requireAuth.js
const { Clerk } = require('@clerk/clerk-sdk-node');
const User = require('../models/user');

const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY }); // sk_live_...

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization; // "Bearer <token>"
    if (!authHeader)
      return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');

    // ✅ Verify JWT using Clerk v5
    const { claims } = await clerk.jwt.verify(token, { template: 'backend' });

    if (!claims || !claims.sub)
      return res.status(401).json({ message: 'Invalid token' });

    // Get Clerk user
    const clerkUser = await clerk.users.getUser(claims.sub);

    const email =
      clerkUser.emailAddresses.find((e) => e.primary)?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      '';

    // Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { clerkId: clerkUser.id },
      { clerkId: clerkUser.id, email, name: clerkUser.firstName || 'NoName' },
      { new: true, upsert: true }
    );

    req.userId = user._id;
    req.user = user;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
};
