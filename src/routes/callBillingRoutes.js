const express = require('express');
const router = express.Router();
const authToken = require('../middleware/authMiddleware');
const callBillingController = require('../controllers/callBillingController');

// Settle a call (duration-based billing)
router.post('/calls/:id/settle', authToken, callBillingController.settleCall);

module.exports = router;