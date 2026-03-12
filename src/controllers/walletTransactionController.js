// src/controllers/walletTransactionController.js
const { WalletTransaction, User } = require('../models');
const { Op } = require('sequelize');

// ✅ Get all transactions (user)
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await WalletTransaction.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Admin view: list all transactions with filters
exports.getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, startDate, endDate, search, userId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (type) where.type = type;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    if (search) {
      where.description = { [Op.like]: `%${search}%` };
    }
    if (userId) where.userId = userId;

    const { rows, count } = await WalletTransaction.findAndCountAll({
      where,
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      transactions: rows,
    });
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};