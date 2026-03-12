const express = require('express');
const router = express.Router();
const { uploadPhoto, updateProfile, getProfile, getDiscoverProfiles } = require('../controllers/profileController');
const authToken = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All routes require authentication
// router.use(authMiddleware);

// Get current user's profile
router.get('/', authToken, getProfile);

// Update profile information
router.put('/', authToken, updateProfile);

// Upload profile photo
router.post('/photo', authToken, upload.single('photo'), uploadPhoto);

router.get('/discover', authToken, getDiscoverProfiles);

module.exports = router; 