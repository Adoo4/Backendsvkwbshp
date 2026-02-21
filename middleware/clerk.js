// clerk.js
require('dotenv').config(); // load .env
const { Clerk } = require('@clerk/clerk-sdk-node');

// Use your **secret key** here
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });

module.exports = clerk;