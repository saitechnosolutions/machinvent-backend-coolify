// services/notificationService.js
const admin = require("../config/firebaseAdmin");
const { User } = require("../models");
const { Op } = require('sequelize');

function stringifyData(data = {}) {
  const result = {};
  for (const key in data) {
    result[key] = String(data[key]);
  }
  return result;
}

async function sendNotification(token, payload) {
  try {
    const message = {
      token,
      notification: { title: payload.title, body: payload.body },
      data: stringifyData(payload.data || {}),
    };
    const res = await admin.messaging().send(message);
    return res;
  } catch (err) {
    // Clean up if token is invalid
    if (
      err.errorInfo?.code === "messaging/registration-token-not-registered" ||
      err.errorInfo?.code === "messaging/invalid-registration-token"
    ) {
      await User.update({ fcmToken: null }, { where: { fcmToken: token } });
      console.warn("Removed invalid FCM token:", token);
    } else {
      console.error("FCM send error:", err);
    }
    throw err; // rethrow so route can log or continue
  }
}

async function sendToUserId(userId, payload) {
  const user = await User.findByPk(userId);
  if (!user || !user.fcmToken) throw new Error("No FCM token for user");
  return sendNotification(user.fcmToken, payload);
}

async function sendToUserIds(userIds, payload) {
  const users = await User.findAll({
    where: { id: { [Op.in]: userIds }, fcmToken: { [Op.ne]: null } },
    attributes: ["id", "fcmToken"],
  });

  const tokens = users.map((u) => u.fcmToken);
  if (!tokens.length) return { successCount: 0, failureCount: 0 };

  // Chunk to max 500 tokens per FCM multicast
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let successCount = 0;
  let failureCount = 0;

  for (const chunk of chunks) {
    const message = {
      tokens: chunk,
      notification: { title: payload.title, body: payload.body },
      data: stringifyData(payload.data || {}),
    };

    const res = await admin.messaging().sendEachForMulticast(message);

    // ✅ Use Promise.allSettled instead of Promise.all
    await Promise.allSettled(
      res.responses.map(async (r, idx) => {
        if (!r.success) {
          failureCount++;
          const err = r.error;
          const code = err?.code || "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            const badToken = chunk[idx];
            console.warn("🗑️ Removed invalid FCM token:", badToken);
            await User.update({ fcmToken: null }, { where: { fcmToken: badToken } });
          } else {
            console.error("❌ FCM send failed:", code);
          }
        } else {
          successCount++;
        }
      })
    );
  }

  return { successCount, failureCount };
}

module.exports = {
  sendNotification,
  sendToUserId,
  sendToUserIds,
};
