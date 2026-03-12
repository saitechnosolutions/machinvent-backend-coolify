const { User } = require('../models/index');

/**
 * Get current authenticated user's profile.
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const userData = user.toJSON();
    // Convert relative photo path to full URL if photo exists
    if (userData.photo) {
      const baseUrl = `http://${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }
    
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get all users (admin function).
 */
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'username', 'photo', 'createdAt', 'updatedAt']
    });
    
    // Convert relative photo paths to full URLs
    const usersWithFullUrls = users.map(user => {
      const userData = user.toJSON();
      if (userData.photo) {
        const baseUrl = `http://${req.get('host')}`;
        userData.photo = `${baseUrl}${userData.photo}`;
      }
      return userData;
    });
    
    res.json(usersWithFullUrls);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get single user by id.
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: ['id', 'email', 'name', 'username', 'photo', 'createdAt', 'updatedAt']
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const userData = user.toJSON();
    // Convert relative photo path to full URL if photo exists
    if (userData.photo) {
      const baseUrl = `http://${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }
    
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update current user's profile (users can only update their own profile).
 */
exports.updateCurrentUser = async (req, res) => {
  try {
    const { id } = req.user; // Get current user's ID from JWT token
    const { name, username, photo } = req.body;
    
    // Only allow updating specific fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (photo !== undefined) updateData.photo = photo;

    const [rowsUpdated] = await User.update(updateData, { where: { id } });

    if (!rowsUpdated) return res.status(404).json({ error: 'User not found' });
    
    const updatedUser = await User.findByPk(id, {
      attributes: ['id', 'email', 'name', 'username', 'photo', 'createdAt', 'updatedAt']
    });
    
    const userData = updatedUser.toJSON();
    // Convert relative photo path to full URL if photo exists
    if (userData.photo) {
      const baseUrl = `http://${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }
    
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update user by id (admin function - can update any user).
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, photo, email } = req.body;
    
    // Only allow updating specific fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (photo !== undefined) updateData.photo = photo;
    if (email !== undefined) updateData.email = email;

    const [rowsUpdated] = await User.update(updateData, { where: { id } });

    if (!rowsUpdated) return res.status(404).json({ error: 'User not found' });
    
    const updatedUser = await User.findByPk(id, {
      attributes: ['id', 'email', 'name', 'username', 'photo', 'createdAt', 'updatedAt']
    });
    
    const userData = updatedUser.toJSON();
    // Convert relative photo path to full URL if photo exists
    if (userData.photo) {
      const baseUrl = `http://${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }
    
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete current user's account.
 */
exports.deleteCurrentUser = async (req, res) => {
  try {
    const { id } = req.user; // Get current user's ID from JWT token
    const rowsDeleted = await User.destroy({ where: { id } });

    if (!rowsDeleted) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.user; // from JWT
    const rowsDeleted = await User.destroy({ where: { id } });

    if (!rowsDeleted) return res.status(404).json({ error: 'User not found' });
    
    res.json({ message: 'Your account has been permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Restore a soft-deleted user
exports.restoreUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.restore({ where: { id } });
    const user = await User.findByPk(id, {
      attributes: ['id', 'email', 'name', 'username', 'photo', 'createdAt', 'updatedAt']
    });
    
    const userData = user.toJSON();
    // Convert relative photo path to full URL if photo exists
    if (userData.photo) {
      const baseUrl = `${req.get('host')}`;
      userData.photo = `${baseUrl}${userData.photo}`;
    }
    
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'User not found or restore failed' });
  }
};

// Permanently delete (force)
exports.forceDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const rowsDeleted = await User.destroy({ where: { id }, force: true });

    if (!rowsDeleted) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
