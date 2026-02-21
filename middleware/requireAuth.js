// middleware/requireAuth.js
const clerk = require('../middleware/clerk'); // <- import the instance
const User = require('../models/user');

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization; // "Bearer <token>"
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');

    // This is the Node SDK verify method
    const { claims } = await clerk.jwt.verify(token, { template: 'backend' });

    if (!claims || !claims.sub) return res.status(401).json({ message: 'Invalid token' });

    // Fetch Clerk user
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