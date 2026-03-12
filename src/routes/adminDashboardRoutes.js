const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/adminDashboardController');
const adminAuth = require('../middleware/adminAuth');


// Protected routes
router.get('/overview', adminAuth, dashboardController.overview);
router.get('/users', adminAuth, dashboardController.listUsers);
router.get('/users/recent', adminAuth, dashboardController.recentUsers);
router.get('/calls', adminAuth, dashboardController.listCalls);
router.get('/calls/top', adminAuth, dashboardController.topCallersOrReceivers);
router.get('/wallets/summary', adminAuth, dashboardController.walletsSummary);
router.get('/purchase-orders', adminAuth, dashboardController.purchaseOrders);
router.get('/offers', adminAuth, dashboardController.listOffers);
router.get('/packages', adminAuth, dashboardController.listPackages);
router.get('/reports', adminAuth, dashboardController.listReports);

// All endpoints under /api/admin/dashboard/analytics/*
router.get("/calls-over-time", adminAuth, dashboardController.callsOverTime);
router.get("/growth", adminAuth, dashboardController.growth);
router.get("/offers-performance", adminAuth, dashboardController.offersPerformance); // notti
router.get("/coins-economy", adminAuth, dashboardController.coinsEconomy); // notti
router.get("/revenue-breakdown", adminAuth, dashboardController.revenueBreakdown); // notti
router.get("/user-engagement", adminAuth, dashboardController.userEngagement);
router.get("/realtime", adminAuth, dashboardController.realtime);


module.exports = router;