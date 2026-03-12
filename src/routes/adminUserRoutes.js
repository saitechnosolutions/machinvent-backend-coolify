// src/routes/adminUserRoutes.js
const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUserController');
const authenticateAdmin = require('../middleware/adminAuth'); 

// All routes protected by admin authentication
router.use(authenticateAdmin);

// List all users
router.get('/', adminUserController.getAllUsers);

// Get single user by ID
router.get('/:id', adminUserController.getUserById);

//update user profile
router.put('/:id', adminUserController.updateUser);

// Ban / Unban
router.patch('/:id/ban', adminUserController.banUser);
router.patch('/:id/unban', adminUserController.unbanUser);

// Soft delete & Restore
router.delete('/:id', adminUserController.softDeleteUser);
router.post('/:id/restore', adminUserController.restoreUser);

// Force delete
router.delete('/:id/force', adminUserController.forceDeleteUser);

module.exports = router;
