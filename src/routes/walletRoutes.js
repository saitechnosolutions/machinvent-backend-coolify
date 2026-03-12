// src/routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authToken = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminAuth');

// User routes
router.get('/', authToken, walletController.getWalletBalance);
router.post('/add', authToken, walletController.addCoins);
router.post('/spend', authToken, walletController.spendCoins);

// Admin route (protected separately in admin router ideally)
router.post('/admin-adjust', adminAuth, walletController.adminAdjustBalance);
router.get('/all-wallets', adminAuth, walletController.listWallets);

// router.get('/wallets', adminAuth, adminWalletController.listWallets);
router.get('/wallets/:userId/transactions', adminAuth, walletController.getUserTransactions);



module.exports = router;
