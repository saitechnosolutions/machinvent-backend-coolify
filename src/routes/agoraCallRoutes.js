// src/routes/agoraCallRoutes.js
const express = require('express');
const router = express.Router();
const generateToken = require('../utils/agoraTokenUtil');
const authenticate = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminAuth');
const callController = require('../controllers/callController');

// POST /call/token
router.post('/token', authenticate, (req, res) => {
  const userId = req.user.id; // from JWT
  const { channelName } = req.body;

  if (!channelName) {
    return res.status(400).json({ error: 'channelName required' });
  }

  const token = generateToken(channelName, userId);
  res.json({
    token,
    channelName,
    uid: userId,
  });
});

router.post('/request', authenticate, callController.requestCall);
router.get('/history', authenticate, callController.getCallHistory);

module.exports = router;
