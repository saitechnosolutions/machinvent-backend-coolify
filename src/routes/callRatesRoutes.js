const express = require('express');
const router = express.Router();
const callRatesController = require('../controllers/callRatesController');
const adminAuth = require('../middleware/adminAuth');
const authToken = require('../middleware/authMiddleware');

// ✅ Admin routes
router.post('/', adminAuth, callRatesController.createCallRate);       
router.get('/', adminAuth, callRatesController.getAllCallRates);       
router.put('/:id', adminAuth, callRatesController.updateCallRate);      
router.delete('/:id', adminAuth, callRatesController.deleteCallRate);  

// ✅ Public (user) route
router.get('/user/rates', authToken, callRatesController.getUserCallRates);

module.exports = router;
