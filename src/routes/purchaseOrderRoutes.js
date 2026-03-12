// src/routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminAuth');

router.post('/create-order', authMiddleware, purchaseOrderController.createOrder);
router.post('/verify', authMiddleware, purchaseOrderController.verifyPayment);
router.get('/my-orders', authMiddleware, purchaseOrderController.getUserOrders);
router.post('/webhook', purchaseOrderController.webhook);

router.get('/list-all', adminAuth, purchaseOrderController.getAllPurchaseOrders);
router.post('/:id/refund', adminAuth, purchaseOrderController.refundOrder);

module.exports = router;
