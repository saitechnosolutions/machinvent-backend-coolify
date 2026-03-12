// src/controllers/adminCallController.js 
const Call = require('../models/calls');
const User = require('../models/userModel');
const { Op } = require('sequelize');

exports.getAllCalls = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search?.trim() || '';
    const status = req.query.status?.trim() || '';
    const callType = req.query.callType?.trim() || '';

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // pick name operator (iLike for postgres, like for others)
    let nameOp = Op.like;
    try {
      const dialect = Call.sequelize?.getDialect?.();
      if (dialect === 'postgres') nameOp = Op.iLike;
    } catch (e) {
      // ignore and use Op.like
    }

    // Build where clauses
    const whereClauses = [];

    // search by either fromUser.name or toUser.name
    if (search) {
      whereClauses.push({
        [Op.or]: [
          { ['$fromUser.name$']: { [nameOp]: `%${search}%` } },
          { ['$toUser.name$']: { [nameOp]: `%${search}%` } },
        ],
      });
    }

    // status filter - allow comma separated (e.g. ?status=ended,missed)
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      whereClauses.push(
        statuses.length > 1 ? { status: { [Op.in]: statuses } } : { status: statuses[0] }
      );
    }

    // callType filter - allow comma separated (e.g. ?callType=video,audio)
    if (callType) {
      const types = callType.split(',').map(t => t.trim()).filter(Boolean);
      whereClauses.push(
        types.length > 1 ? { callType: { [Op.in]: types } } : { callType: types[0] }
      );
    }

    const whereCondition = whereClauses.length ? { [Op.and]: whereClauses } : {};

    // include users (needed so nested $fromUser.name$ and $toUser.name$ work)
    const include = [
      { model: User, as: 'fromUser', attributes: ['id', 'name', 'photo'], required: false },
      { model: User, as: 'toUser', attributes: ['id', 'name', 'photo'], required: false },
    ];
    
    // total count for pagination
    const total = await Call.count({
      where: whereCondition,
      include,
      distinct: true, // ensure accurate count when joins present
    });

    const calls = await Call.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'fromUser',
          attributes: ['id', 'name', 'photo'],
          required: false,
        },
        {
          model: User,
          as: 'toUser',
          attributes: ['id', 'name', 'photo'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const formatted = calls.map((call) => ({
      id: call.id,
      fromUser: call.fromUser
        ? {
            id: call.fromUser.id,
            name: call.fromUser.name,
            photo: call.fromUser.photo
              ? `${baseUrl}${call.fromUser.photo}`
              : null,
          }
        : null,
      toUser: call.toUser
        ? {
            id: call.toUser.id,
            name: call.toUser.name,
            photo: call.toUser.photo
              ? `${baseUrl}${call.toUser.photo}`
              : null,
          }
        : null,
      callType: call.callType,
      channelName: call.channelName,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      duration: call.duration,
      callerRating: call.callerRating,
      callerComment: call.callerComment,
      receiverRating: call.receiverRating,
      receiverComment: call.receiverComment,
      createdAt: call.createdAt,
    }));

    return res.json({ data: formatted, total });
  } catch (err) {
    console.error('Error fetching admin call history:', err);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};
