const express = require("express");
const { Clerk } = require("@clerk/clerk-sdk-node");
const { requireAuth } = require("@clerk/express");

const router = express.Router();
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });

// PUT /update-profile
router.put("/update-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId; // securely from Clerk JWT
    const { form } = req.body;

    if (!form) {
      return res.status(400).json({ error: "Missing form data" });
    }

    // Update Clerk user profile
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
