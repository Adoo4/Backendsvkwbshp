const express = require("express");
const { Clerk } = require("@clerk/clerk-sdk-node");

const router = express.Router();
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });
console.log("User routes loaded");
// PUT /update-profile
router.put("/update-profile", async (req, res) => {
  try {
    const { userId, form } = req.body;

    if (!userId || !form) {
      return res.status(400).json({ error: "Missing userId or form data" });
    }

    // Update the Clerk user profile
    await clerk.users.updateUser(userId, {
      privateMetadata: { ...form },
    });

    res.status(200).json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

module.exports = router;