const { Clerk, verifyJwt } = require('@clerk/clerk-sdk-node');

module.exports = async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');
    console.log('Incoming token:', token);

    // ✅ Use verifyJwt, not clerk.jwt.verify
    const { claims } = await verifyJwt(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      template: 'backend', // the template you use
    });

    if (!claims || !claims.sub)
      return res.status(401).json({ message: 'Invalid token' });

    const clerkClient = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerkClient.users.getUser(claims.sub);

    const email =
      clerkUser.emailAddresses.find((e) => e.primary)?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      '';

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