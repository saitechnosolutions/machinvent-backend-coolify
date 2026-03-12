// src/controllers/callController.js
const Call = require('../models/calls');
const User = require('../models/userModel');
const userSocketMap = require('../sockets/userSocketMap');
const { Op } = require('sequelize');

// 1. Caller sends request
exports.requestCall = async (req, res) => {
  const fromUserId = req.user.id;
  const { toUserId, callType, channelName } = req.body;

  try {
    const call = await Call.create({
      fromUserId,
      toUserId,
      callType,
      channelName,
      status: 'missed',
    });

    // Emit to receiver if online
    const receiverSocket = userSocketMap.get(toUserId);
    if (receiverSocket) {
      receiverSocket.emit('call:request', {
        fromUserId,
        callId: call.id,
        callType,
        channelName,
      });
    }

    res.status(201).json({ callId: call.id, message: 'Call initiated' });
  } catch (err) {
    console.error('Call request failed:', err);
    res.status(500).json({ error: 'Call request failed' });
  }
};

exports.getCallHistory = async (req, res) => {
  const userId = req.user.id; // JWT middleware should set req.user
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const calls = await Call.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'name', 'photo'] },
        { model: User, as: 'toUser', attributes: ['id', 'name', 'photo'] }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    // Format data for frontend
    const formatted = calls.map(call => {
      const isCaller = call.fromUserId === userId;
      let type;

      if (call.status === 'missed') {
        type = 'missed';
      } else {
        type = isCaller ? 'outgoing' : 'incoming';
      }

      const otherUser = isCaller ? call.toUser : call.fromUser;

      // Duration formatting
      let durationText = '';
      if (call.duration !== null && call.duration >= 0) {
        const minutes = Math.floor(call.duration / 60);
        const seconds = call.duration % 60;
        if (minutes > 0) durationText += `${minutes} min `;
        if (seconds > 0) durationText += `${seconds} sec`;
        durationText = durationText.trim();
      }

      return {
        id: call.id,
        name: otherUser ? otherUser.name : 'Unknown',
        profileUrl: otherUser ? otherUser.photo : null,
        type,
        time: call.createdAt,
        duration: durationText,
        callStatus: call.status,
        isVideo: call.callType === 'video',
        callerRating: call.callerRating,
        callerComment: call.callerComment,
        receiverRating: call.receiverRating,
        receiverComment: call.receiverComment
      };
    });

    res.json({ data: formatted });

  } catch (err) {
    console.error('Error fetching call history:', err);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};


