require('dotenv').config();
const { createRemoteJWKSet, jwtVerify } = require('jose');

const JWKS = createRemoteJWKSet(new URL('https://clerk.bookstore.ba/.well-known/jwks.json'));

async function verifyClerkJWT(token) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'https://clerk.bookstore.ba',
      audience: 'backend', // matches your JWT template audience
    });
    return payload; // contains claims
  } catch (err) {
    console.error('JWT verify failed:', err);
    throw err;
  }
}

module.exports = verifyClerkJWT;