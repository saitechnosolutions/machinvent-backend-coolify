const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const adminAuth = require('../middleware/adminAuth');

// --------- Public routes --------- //

// First-time superadmin creation (only once, then disable/remove)
router.post('/create-superadmin', adminAuthController.createSuperAdmin);

// Login (email + password)
router.post('/login', adminAuthController.login);

// --------- Protected routes (require admin JWT) --------- //

// Example: add a new admin (only superadmin can do this)
router.post('/add', adminAuth, adminAuthController.addAdmin);

// Example: get profile of logged-in admin
router.get('/me', adminAuth, (req, res) => {
  res.json({ message: 'Admin authenticated', admin: req.admin });
});

router.get('/all', adminAuth, adminAuthController.listAdmins);
router.put('/:id', adminAuth, adminAuthController.updateAdmin);
router.delete('/:id', adminAuth, adminAuthController.softDeleteAdmin);
router.delete('/:id/force', adminAuth, adminAuthController.hardDeleteAdmin);
router.post('/:id/restore', adminAuth, adminAuthController.restoreAdmin);

module.exports = router;
