const express = require("express");
const { Clerk } = require("@clerk/clerk-sdk-node");
const { requireAuth } = require("@clerk/express");
const User = require("../models/user"); // your Mongoose User model

const router = express.Router();
const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });

router.put("/update-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId; // from Clerk JWT
    const { form } = req.body;

    if (!form) {
      return res.status(400).json({ error: "Missing form data" });
    }

    // 🔹 Fetch Clerk user
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses.find(e => e.primary)?.emailAddress || "";

    // 🔹 Update Clerk private metadata
    await clerk.users.updateUser(userId, {
      privateMetadata: { ...form },
    });

    // 🔹 Update MongoDB user document
    const updatedUser = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        ...form,
        email,
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
});

module.exports = router;

