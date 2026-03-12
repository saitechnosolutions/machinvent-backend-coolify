// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { User } = require("../models");
const NotificationService = require("../utils/notificationService");
const { sendNotification } = require("../utils/notificationService");
const authToken = require("../middleware/authMiddleware"); 
const adminAuth = require("../middleware/adminAuth");       

// Send test notification to logged in user
router.post("/test", authToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user || !user.fcmToken) {
      return res.status(400).json({ error: "No FCM token found for user" });
    }

    console.log("Sending test notification to user:", user.fcmToken);

    // 🔥 Call your notification service
    await sendNotification(user.fcmToken, {
      title: "Test Notification 🚀",
      body: "This is a test push from backend",
      data: { type: "test" },
    });

    res.json({ success: true, message: "Notification sent successfully" });
  } catch (err) {
    console.error("Error sending notification:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// 1) Device token upsert (keep your existing route)
router.post("/update-token", authToken, async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware
    const { fcmToken } = req.body;

    await User.update({ fcmToken }, { where: { id: userId } });
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to update FCM token:", err);
    res.status(500).json({ error: "Failed to update FCM token" });
  }
});

// 2) Send to the logged-in user
router.post("/send-to-user", authToken, async (req, res) => {
  try {
    const userId = req.user.id; // ✅ now comes from JWT
    const { title, body, data } = req.body;

    await NotificationService.sendToUserId(userId, { title, body, data });
    res.json({ success: true });
  } catch (err) {
    console.error("Error in /send-to-user:", err);
    res.status(500).json({ error: err.message || "Failed to send" });
  }
});

// Send notification to specific users
router.post("/send-to-users", adminAuth, async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;

    if (!userIds?.length) {
      return res.status(400).json({ error: "No user IDs provided" });
    }

    const users = await User.findAll({
      where: { id: userIds, fcmToken: { [Op.ne]: null } },
      attributes: ["id", "fcmToken"],
    });

    if (!users.length)
      return res.status(404).json({ error: "No valid users with FCM tokens" });

    const tokens = users.map((u) => u.fcmToken);

    await Promise.all(
      tokens.map((token) =>
        NotificationService.sendNotification(token, { title, body, data })
      )
    );

    res.json({
      success: true,
      message: `Notification sent to ${users.length} user(s).`,
    });
  } catch (err) {
    console.error("Admin send-to-users error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Broadcast to all users with tokens
router.post("/broadcast", adminAuth, async (req, res) => {
  try {
    const { title, body, data } = req.body;

    const users = await User.findAll({
      where: { fcmToken: { [Op.ne]: null } },
      attributes: ["fcmToken"],
    });

    if (!users.length)
      return res.status(404).json({ error: "No users with valid FCM tokens" });

    const tokens = users.map((u) => u.fcmToken);

    const results = await Promise.allSettled(
      tokens.map((token) =>
        NotificationService.sendNotification(token, { title, body, data })
      )
    );

    // Optional: Count successful and failed sends
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failedCount = results.filter(r => r.status === "rejected").length;

    res.json({
      success: true,
      message: `Broadcast sent: ${successCount} succeeded, ${failedCount} failed.`,
    });
  } catch (err) {
    console.error("Admin broadcast error:", err);
    res.status(500).json({ error: "Failed to broadcast notifications" });
  }
});

module.exports = router;
