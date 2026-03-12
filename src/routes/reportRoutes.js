const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authToken = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminAuth');

// Submit a report (authenticated users)
router.post('/', authToken, reportController.createReport);

// List pending reports (admin only)
router.get('/', adminAuth,reportController.listReports);

// Update report status (admin only)
router.put('/:id', adminAuth, reportController.updateReport);

// Delete report (admin only)
router.delete('/:id', adminAuth, reportController.deleteReport);

module.exports = router;
