const { verifyClerkJWT, getClerkUser } = require('./testClerkJWT');
const User = require('../models/user');

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');
    const claims = await verifyClerkJWT(token);

    if (!claims?.sub) return res.status(401).json({ message: 'Invalid token' });

    const clerkUser = await getClerkUser(claims.sub);
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