// requireAuth.js
const { jwtVerify, users } = require('@clerk/clerk-sdk-node');
const User = require('../models/user');

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');
    const verified = await jwtVerify(token, {
      audience: 'backend',
      issuer: process.env.CLERK_ISSUER
    });

    const claims = verified.claims;

    if (!claims || !claims.sub) return res.status(401).json({ message: 'Invalid token' });

    // Upsert user in MongoDB
    const clerkUser = await users.getUser(claims.sub);
    const email =
      clerkUser.emailAddresses.find(e => e.primary)?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      '';

    const user = await User.findOneAndUpdate(
      { clerkId: claims.sub },
      { clerkId: claims.sub, email, name: clerkUser.firstName || 'NoName' },
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