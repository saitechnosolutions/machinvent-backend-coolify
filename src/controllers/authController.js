const db = require('../models');
const jwt = require('jsonwebtoken');
const admin = require('../config/firebaseAdmin');
const { Op } = require('sequelize');
const axios = require('axios');
const User = db.User;
const Otp = db.Otp;

// utils
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');

// exports.firebaseAuth = async (req, res) => {
//   const { idToken } = req.body;
  
//   if (!idToken) {
//     return res.status(400).json({ error: 'ID token is required' });
//   }

//   try {
//     // 1. Verify the Firebase ID token
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     const { uid, email, name, picture } = decodedToken;

//     // 2. Find or create user in your DB
//     let user = await User.findOne({ where: { firebaseUid: uid } });
    
//     if (!user) {
//       // New user - create account
//       user = await User.create({
//         firebaseUid: uid,
//         email,
//         name,
//         // photo: picture,
//         username: name || email.split('@')[0],
//         password: null, // No password for passwordless auth
//         isProfileComplete: false, // New users need to complete profile
//       });
//     }

//     // 3. Update user online status
//     await user.update({ isOnline: true });

//     // 4. Generate JWT tokens
//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     // Compute ban status
//     const now = new Date();
//     const isEffectivelyBanned =
//       user.isBanned && (user.bannedUntil === null || new Date(user.bannedUntil) > now);

//     res.json({ 
//       accessToken, 
//       refreshToken, 
//       user: {
//         id: user.id,
//         email: user.email,
//         name: user.name,
//         username: user.username,
//         photo: user.photo,
//         isProfileComplete: user.isProfileComplete,
//         isBanned: user.isBanned,
//         banReason: user.banReason || null,
//         bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
//         isEffectivelyBanned,
//       },
//       isNewUser: !user.createdAt || (new Date() - user.createdAt) < 5000 // Check if user was just created
//     });
//   } catch (error) {
//     console.error('Firebase auth error:', error);
//     res.status(401).json({ message: 'Invalid ID token', error: error.message });
//   }
// };

exports.firebaseAuth = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    // 1️⃣ Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // 2️⃣ Try finding user by firebaseUid OR email
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { firebaseUid: uid },
          { email }
        ]
      }
    });

    // 3️⃣ If found but firebaseUid missing, attach it
    if (user && !user.firebaseUid) {
      await user.update({ firebaseUid: uid });
    }

    // 4️⃣ If not found at all, create new one
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email,
        name,
        username: name || (email ? email.split('@')[0] : `user_${uid.slice(0, 6)}`),
        password: null,
        isProfileComplete: false,
      });
    }

    // 5️⃣ Update user online
    await user.update({ isOnline: true });

    // 6️⃣ Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const now = new Date();
    const isEffectivelyBanned =
      user.isBanned && (user.bannedUntil === null || new Date(user.bannedUntil) > now);

    // 7️⃣ Respond
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        photo: user.photo,
        isProfileComplete: user.isProfileComplete,
        isBanned: user.isBanned,
        banReason: user.banReason || null,
        bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
        isEffectivelyBanned,
      },
      isNewUser:
        !user.createdAt || new Date() - new Date(user.createdAt) < 5000,
    });
  } catch (error) {
    console.error('Firebase auth error:', error);
    res.status(401).json({ message: 'Invalid ID token', error: error.message });
  }
};

exports.sendOtp = async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  try {
    let user = await User.findOne({ where: { phone } });

    if (!user) {
      // Create a shell user if not exists
      user = await User.create({
        phone,
        username: `user_${phone.slice(-6)}`,
        firebaseUid: `custom_${phone}`,
        isProfileComplete: false,
      });
    }

    // Store OTP (with 5 min expiry)
    await db.Otp.upsert({
      otp: otp.toString(),
      mobile_no: phone,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    });

    res.json({ message: 'OTP stored successfully' });
  } catch (err) {
    console.error('Store OTP error:', err);
    res.status(500).json({ message: 'Failed to store OTP', error: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  try {
    const otpRecord = await db.Otp.findOne({
      where: { mobile_no: phone, otp: otp.toString() },
      order: [['createdAt', 'DESC']],
    });

    if (!otpRecord || new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await db.User.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({ isOnline: true });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Compute ban status
    const now = new Date();
    const isEffectivelyBanned =
      user.isBanned && (user.bannedUntil === null || new Date(user.bannedUntil) > now);

    res.json({
      message: 'OTP verified successfully',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        username: user.username,
        photo: user.photo,
        isProfileComplete: user.isProfileComplete,
        isBanned: user.isBanned,
        banReason: user.banReason || null,
        bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
        isEffectivelyBanned,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Failed to verify OTP', error: err.message });
  }
};

exports.refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Missing refresh token' });

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Optionally fetch user and update status
    const user = await User.findByPk(payload.id);
    if (user) await user.update({ isOnline: true });

    const newAccessToken = generateAccessToken({ id: payload.id, email: payload.email });
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
};

exports.logout = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(400).json({ message: 'Missing token' });

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        // Token expired, decode it without verifying signature
        decoded = jwt.decode(token);
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: 'Invalid token', error: err.message });
        }
        // Proceed to update user as logged out
      } else {
        // Other errors (invalid token)
        console.error('Logout error:', err);
        return res.status(401).json({ message: 'Invalid token', error: err.message });
      }
    }
    const user = await User.findByPk(decoded.id);
    if (user) {
      await user.update({
        isOnline: false,
        lastSeen: new Date()
      });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error during logout', error: err.message });
  }
};