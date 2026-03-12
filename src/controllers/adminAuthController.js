const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateAdminAccessToken } = require('../utils/adminTokenUtils');
const db = require('../models');
const Admin = db.Admin;

// Create first superadmin
exports.createSuperAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const exists = await Admin.findOne({ where: { email } });
    if (exists) {
      return res.status(400).json({ message: 'Superadmin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name, email, password: hashedPassword, role: 'superadmin' });

    res.json({ message: 'Superadmin created successfully', admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ where: { email,  } });
    if (!admin) return res.status(404).json({ message: 'Admin not found or deactivated' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    await admin.update({ lastLogin: new Date() });

    const accessToken = generateAdminAccessToken(admin);

    res.json({ 
      accessToken,  
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new admin (only superadmin)
exports.addAdmin = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ message: 'Only superadmin can add new admins' });
  }

  try {
    const exists = await Admin.findOne({ where: { email } });
    if (exists) return res.status(400).json({ message: 'Admin already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name, email, password: hashedPassword, role: role || 'admin' });

    res.json({ message: 'Admin created successfully', admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update admin details (only superadmin can update others)
exports.updateAdmin = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  try {
    const admin = await Admin.findByPk(id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    // If the target admin is a superadmin, only superadmins can update
    if (admin.role === 'superadmin' && req.admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Not authorized to update a superadmin' });
    }

    // Non-superadmins can only update themselves or other admins, not superadmins
    if (req.admin.role !== 'superadmin' && req.admin.id !== admin.id) {
      return res.status(403).json({ message: 'Not authorized to update this admin' });
    }

    // Prevent changing role unless the requester is a superadmin
    if (role && req.admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can change roles' });
    }

    // Perform updates
    if (name) admin.name = name;
    if (email) admin.email = email;
    if (role && req.admin.role === 'superadmin') admin.role = role;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      admin.password = hashedPassword;
    }

    await admin.save();

    res.json({
      message: 'Admin updated successfully',
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List all admins (optionally filter by role or exclude deleted ones)
exports.listAdmins = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: ['id', 'name', 'email', 'role', 'deletedAt', 'createdAt', 'lastLogin'],
      paranoid: false
    });

    res.json({ admins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.restoreAdmin = async (req, res) => {
  const { id } = req.params;

  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ message: 'Only superadmin can restore admins' });
  }

  try {
    // Include soft-deleted records by setting paranoid: false
    const admin = await Admin.findByPk(id, { paranoid: false });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    if (!admin.deletedAt) {
      return res.status(400).json({ message: 'Admin is not deleted' });
    }

    await admin.restore(); // Sequelize restores the record by nullifying deletedAt

    res.json({ message: 'Admin restored successfully', admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Soft delete an admin
exports.softDeleteAdmin = async (req, res) => {
  const { id } = req.params;

  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ message: 'Only superadmin can delete admins' });
  }

  if (req.admin.id.toString() === id) {
    return res.status(400).json({ message: 'You cannot not delete yourself' });
  }

  try {
    const admin = await Admin.findByPk(id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    await admin.destroy(); // This sets deletedAt automatically when paranoid is enabled

    res.json({ message: 'Admin soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Hard delete an admin permanently
exports.hardDeleteAdmin = async (req, res) => {
  const { id } = req.params;

  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ message: 'Only superadmin can permanently delete admins' });
  }

  if (req.admin.id.toString() === id) {
    return res.status(400).json({ message: 'You should not delete yourself' });
  }

  try {
    const admin = await Admin.findByPk(id, { paranoid: false }); // Include soft-deleted records
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    await admin.destroy({ force: true }); // Force permanent deletion

    res.json({ message: 'Admin permanently deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
