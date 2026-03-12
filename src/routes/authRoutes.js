const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');

router.post('/google', authCtrl.firebaseAuth);
// router.post('/otp', authCtrl.phoneOtpAuth);
router.post('/otp/send', authCtrl.sendOtp);
router.post('/otp/verify', authCtrl.verifyOtp);
router.post('/refresh', authCtrl.refreshAccessToken);
router.post('/logout', authCtrl.logout);

module.exports = router;
