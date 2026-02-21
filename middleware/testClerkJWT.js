// middleware/verifyClerkJWT.js
const { Clerk } = require('@clerk/clerk-sdk-node');
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });

async function verifySessionToken(token) {
  try {
    // This verifies a frontend session token (no 'aud' claim needed)
    const session = await clerk.sessions.verifyToken(token);
    console.log('Session verified:', session);
    return session;
  } catch (err) {
    console.error('Session verification failed:', err);
    throw err;
  }
}

module.exports = { verifySessionToken, clerk };