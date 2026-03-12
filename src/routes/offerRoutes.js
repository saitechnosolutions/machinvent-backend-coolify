const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const authToken = require('../middleware/authMiddleware');
const adminAuthToken = require('../middleware/adminAuth');

// --------------------
// Admin Routes
// --------------------
router.post('/', adminAuthToken, offerController.createOffer);
router.get('/list', adminAuthToken, offerController.listOffers);
router.put('/:id', adminAuthToken, offerController.updateOffer);
router.delete('/:id', adminAuthToken, offerController.deleteOffer);

// --------------------
// User Routes
// --------------------
router.get('/list', authToken, offerController.listOffers);
router.get('/active', authToken, offerController.getActiveOffers);

module.exports = router;
