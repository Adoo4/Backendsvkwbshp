const { verifySessionToken, clerk } = require('./testClerkJWT'); // use the shared verification file
const User = require('../models/user');

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) 
      return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');

    // ✅ Verify the frontend session token
    const session = await verifySessionToken(token);

    if (!session || !session.userId) 
      return res.status(401).json({ message: 'Invalid token' });

    // Fetch Clerk user info
    const clerkUser = await clerk.users.getUser(session.userId);

    const email =
      clerkUser.emailAddresses.find(e => e.primary)?.emailAddress ||
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