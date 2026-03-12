// src/controllers/adminUserController.js
const { User } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all users (admin).
 */
// exports.getAllUsers = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const offset = (page - 1) * limit;

//     const { status, search } = req.query;

//     const where = {};
//     let paranoid = true;

//     if (status === 'banned') {
//       where.isBanned = true;
//     } else if (status === 'active') {
//       where.isBanned = false;
//     } else if (status === 'deleted') {
//       paranoid = false;
//       where.deletedAt = { [Op.ne]: null };
//     }

//     if (search) {
//       where[Op.or] = [
//         { name: { [Op.iLike]: `%${search}%` } },
//         { username: { [Op.iLike]: `%${search}%` } },
//         { email: { [Op.iLike]: `%${search}%` } },
//         { phone: { [Op.iLike]: `%${search}%` } },
//         { city: { [Op.iLike]: `%${search}%` } },
//       ];
//     }

//     const { count, rows } = await User.findAndCountAll({
//       where,
//       paranoid,
//       limit,
//       offset,
//       order: [['createdAt', 'DESC']],
//       attributes: [
//         'id',
//         'email',
//         'name',
//         'username',
//         'photo',
//         'city',
//         'isBanned',
//         'banReason',
//         'bannedUntil',
//         'deletedAt',
//         'createdAt',
//         'updatedAt',
//         'isProfileComplete',
//         'isOnline',
//         'lastSeen'
//       ]
//     });

//     const baseUrl = `${req.protocol}://${req.get('host')}`;
//     const now = new Date();

//     // Auto unban users with expired bans
//     const usersWithFullUrls = await Promise.all(rows.map(async user => {
//       const data = user.toJSON();
//       if (data.isBanned && data.bannedUntil !== null && new Date(data.bannedUntil) <= now) {
//         // Ban expired → auto unban
//         await user.update({
//           isBanned: false,
//           banReason: null,
//           bannedUntil: null
//         });
//         data.isBanned = false;
//         data.banReason = null;
//         data.bannedUntil = null;
//       }

//       data.isEffectivelyBanned = data.isBanned && 
//         (data.bannedUntil === null || new Date(data.bannedUntil) > now);

//       if (data.photo) {
//         data.photo = `${baseUrl}${data.photo}`;
//       }
//       return data;
//     }));

//     res.json({
//       total: count,
//       page,
//       limit,
//       totalPages: Math.ceil(count / limit),
//       data: usersWithFullUrls
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { status, search } = req.query;

    const where = {};
    let paranoid = false; // 👈 include deleted users by default

    if (status === 'banned') {
      where.isBanned = true;
    } else if (status === 'active') {
      where.isBanned = false;
      where.deletedAt = null; // 👈 exclude deleted ones for 'active'
    } else if (status === 'deleted') {
      where.deletedAt = { [Op.ne]: null }; // 👈 only deleted users
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      paranoid, // 👈 now includes deleted by default
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'email',
        'name',
        'username',
        'photo',
        'city',
        'isBanned',
        'banReason',
        'bannedUntil',
        'deletedAt',
        'createdAt',
        'updatedAt',
        'isProfileComplete',
        'isOnline',
        'lastSeen'
      ]
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const now = new Date();

    // Auto unban users with expired bans
    const usersWithFullUrls = await Promise.all(rows.map(async user => {
      const data = user.toJSON();
      if (data.isBanned && data.bannedUntil && new Date(data.bannedUntil) <= now) {
        await user.update({
          isBanned: false,
          banReason: null,
          bannedUntil: null
        });
        data.isBanned = false;
        data.banReason = null;
        data.bannedUntil = null;
      }

      data.isEffectivelyBanned = data.isBanned && 
        (data.bannedUntil === null || new Date(data.bannedUntil) > now);

      if (data.photo) {
        data.photo = `${baseUrl}${data.photo}`;
      }
      return data;
    }));

    res.json({
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: usersWithFullUrls
    });
  } catch (err) {
    console.error('🔥 [getAllUsers] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


/**
 * Get single user by ID (admin).
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      paranoid: false,
      attributes: [
        'id',
        'username',
        'email',
        'phone',
        'name',
        'photo',
        'gender',
        'dateOfBirth',
        'city',
        'bio',
        'interests',
        'languages',
        'isProfileComplete',
        'lastSeen',
        'isOnline',
        'fcmToken',
        'isBanned',
        'banReason',
        'bannedUntil',
        'deletedAt',
        'createdAt',
        'updatedAt'
      ]
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const userData = user.toJSON();

    // Auto unban if ban expired
    if (userData.isBanned && userData.bannedUntil !== null && new Date(userData.bannedUntil) <= now) {
      await user.update({
        isBanned: false,
        banReason: null,
        bannedUntil: null
      });
      userData.isBanned = false;
      userData.banReason = null;
      userData.bannedUntil = null;
    }

    userData.isEffectivelyBanned = userData.isBanned && 
      (userData.bannedUntil === null || new Date(userData.bannedUntil) > now);

    if (userData.photo) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }

    res.json(userData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update user profile
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      gender,
      email,
      dateOfBirth,
      city,
      bio,
      interests,
      languages,
      phone
    } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Require at least one of email or phone
    if (!email && !phone) {
      console.log('Neither email nor phone provided');
      return res.status(400).json({ message: 'Either email or phone is required' });
    }

    const userData = user.toJSON();

    if (userData.photo) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }

    // Check if all required fields are provided
    const requiredFields = ['name', 'gender', 'dateOfBirth', 'city', 'interests', 'languages'];
    const hasAllFields = requiredFields.every(
      field => req.body[field] !== undefined && req.body[field] !== null
    );

    // Prepare update data
    const updateData = {
      name,
      gender,
      email: email && email.trim() !== '' ? email.trim() : null,
      dateOfBirth,
      city,
      bio,
      interests: Array.isArray(interests) ? interests : [],
      languages: Array.isArray(languages) ? languages : [],
      phone: phone && phone.trim() !== '' ? phone.trim() : null,
      isProfileComplete: hasAllFields
    };

    await user.update(updateData);

    // Convert relative photo path to full URL if photo exists
    let photoUrl = null;
    if (user.photo) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      photoUrl = `${baseUrl}${user.photo}`;
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: photoUrl,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        city: user.city,
        bio: user.bio,
        interests: user.interests,
        languages: user.languages,
        isProfileComplete: user.isProfileComplete
      }
    });

  } catch (err) {
    console.error('Error in updateUser:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Ban user.
 */
exports.banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { banReason, bannedUntil } = req.body;

    const bannedUntilDate = new Date(bannedUntil);
    if (isNaN(bannedUntilDate.getTime()) || bannedUntilDate <= new Date()) {
      return res.status(400).json({ error: 'Invalid or past banUntil date' });
    }

    const [rowsUpdated] = await User.update(
      { 
        isBanned: true, 
        banReason, 
        bannedUntil: bannedUntilDate 
      },
      { where: { id } }
    );

    if (!rowsUpdated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User banned successfully', 
      banReason, 
      bannedUntil: bannedUntilDate.toISOString() 
    });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Unban user.
 */
exports.unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const [rowsUpdated] = await User.update(
      { isBanned: false, banReason: null },
      { where: { id } }
    );

    if (!rowsUpdated) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User unbanned successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Soft delete user.
 */
exports.softDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const rowsDeleted = await User.destroy({ where: { id } });

    if (!rowsDeleted) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Restore user.
 */
exports.restoreUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.restore({ where: { id } });

    const user = await User.findByPk(id, {
      attributes: ['id', 'email', 'name', 'username', 'isBanned', 'photo']
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const userData = user.toJSON();
    if (userData.photo) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }

    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'User not found or restore failed' });
  }
};

/**
 * Force delete user (permanent).
 */
exports.forceDeleteUser = async (req, res) => {
  try {
    console.log("🧩 [forceDeleteUser] Request received");

    const { id } = req.params;
    console.log("🆔 User ID from params:", id);

    if (!id) {
      console.log("❌ No user ID provided in request params");
      return res.status(400).json({ error: "User ID is required" });
    }

    console.log("🧹 Attempting permanent delete for user ID:", id);

    const rowsDeleted = await User.destroy({ where: { id }, force: true });

    console.log("🧾 Sequelize destroy result (rows deleted):", rowsDeleted);

    if (!rowsDeleted) {
      console.log("⚠️ No user found with ID:", id);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User permanently deleted:", id);
    res.json({ message: "User permanently deleted" });

  } catch (err) {
    console.error("🔥 [forceDeleteUser] Server error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

