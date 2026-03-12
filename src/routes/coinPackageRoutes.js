const express = require('express');
const router = express.Router();
const coinPackageController = require('../controllers/coinPackageController');
const authToken = require('../middleware/authMiddleware');
const adminAuthToken = require('../middleware/adminAuth');

// Admin Routes
router.post('/', adminAuthToken, coinPackageController.createPackage);
router.get('/list', adminAuthToken, coinPackageController.listPackages);
router.put('/:id', adminAuthToken, coinPackageController.updatePackage);
router.delete('/:id', adminAuthToken, coinPackageController.deletePackage);

// User Routes
router.get('/list', authToken, coinPackageController.listPackages);
router.get('/active', authToken, coinPackageController.getActivePackages);

module.exports = router;
