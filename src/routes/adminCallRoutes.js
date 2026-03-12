// src/routes/adminCallRoutes.js
const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminCallController = require('../controllers/adminCallController');

// GET /admin/call
router.get('/', adminAuth, adminCallController.getAllCalls);

module.exports = router;
