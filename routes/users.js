const express = require("express");
const { requireAuth } = require("@clerk/express");
const { users } = require("@clerk/clerk-sdk-node"); // v5 style
const User = require("../models/user");

const router = express.Router();

router.put("/update-profile", requireAuth({}), async (req, res) => {
  try {
    const userId = req.auth.userId; // JWT from Clerk

    const { form } = req.body;
    if (!form) return res.status(400).json({ error: "Missing form data" });

    // Fetch Clerk user
    const clerkUser = await users.getUser(userId);
    const email = clerkUser.emailAddresses.find(e => e.primary)?.emailAddress || "";

    // Update Clerk private metadata
    await users.updateUser(userId, { privateMetadata: { ...form } });

    // Update MongoDB user document
    const updatedUser = await User.findOneAndUpdate(
      { clerkId: userId },
      { ...form, email },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

module.exports = router;