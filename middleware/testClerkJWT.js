// middleware/verifyClerkJWT.js
require('dotenv').config();
const { jwtVerify, users } = require('@clerk/clerk-sdk-node');

/**
 * Verifies a frontend session token or JWT
 * @param {string} token - The token from the frontend (Bearer token)
 * @returns {object} claims - The JWT claims
 */
async function verifyClerkJWT(token) {
  try {
    const verified = await jwtVerify(token, {
      issuer: process.env.CLERK_ISSUER,   // e.g., https://clerk.bookstore.ba
      audience: 'backend',                // MUST match the audience in your JWT template
    });

    console.log('JWT verified:', verified.claims);
    return verified.claims;
  } catch (err) {
    console.error('JWT verification failed:', err);
    throw err;
  }
}

/**
 * Get user data from Clerk by userId (sub claim)
 */
async function getClerkUser(userId) {
  return await users.getUser(userId);
}

module.exports = { verifyClerkJWT, getClerkUser };