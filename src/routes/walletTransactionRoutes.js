// src/routes/walletTransactionRoutes.js
const express = require('express');
const router = express.Router();
const walletTransactionController = require('../controllers/walletTransactionController');
const authToken = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminAuth');

// User’s transaction history
router.get('/', authToken, walletTransactionController.getUserTransactions);

// Admin route for filtered view
router.get('/all', adminAuth, walletTransactionController.getAllTransactions);

module.exports = router;
