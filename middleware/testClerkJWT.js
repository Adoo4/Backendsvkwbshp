// middleware/testClerkJWT.js
require('dotenv').config();
const { verifyJwt, users } = require('@clerk/clerk-sdk-node'); // <-- note: verifyJwt

/**
 * Verifies a frontend session token or JWT
 * @param {string} token
 */
async function verifyClerkJWT(token) {
  try {
    const verified = await verifyJwt(token, {
      issuer: process.env.CLERK_ISSUER,  // e.g., https://clerk.bookstore.ba
      audience: 'backend',                // must match your JWT template audience
    });
    console.log('JWT verified:', verified.claims);
    return verified.claims;
  } catch (err) {
    console.error('JWT verification failed:', err);
    throw err;
  }
}

/**
 * Get Clerk user by ID
 */
async function getClerkUser(userId) {
  return await users.getUser(userId);
}

module.exports = { verifyClerkJWT, getClerkUser };