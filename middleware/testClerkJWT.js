// testClerkJWT.js
const { Clerk } = require('@clerk/clerk-sdk-node');

const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });

async function test(token) {
  try {
    const { claims } = await clerk.jwt.verify(token, { template: 'backend' });
    console.log('Claims:', claims);
  } catch (err) {
    console.error('JWT verify failed:', err);
  }
}

// Replace this with the token you get from your frontend
const token = '<PASTE_YOUR_TOKEN_HERE>';

test(token);