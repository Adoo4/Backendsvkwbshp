const User = require("../models/User"); // adjust path

router.put("/update-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId; // Clerk ID
    const { form } = req.body;

    if (!form) return res.status(400).json({ error: "Missing form data" });

    // Update Clerk privateMetadata
    await clerk.users.updateUser(userId, {
      privateMetadata: { ...form },
    });

    // Update MongoDB user document
    const updatedUser = await User.findOneAndUpdate(
      { clerkId: userId },
      { ...form },
      { new: true }
    );

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

