// src/controllers/walletController.js
const { Wallet, WalletTransaction, User } = require('../models');
const { Op } = require('sequelize');

// ✅ Get wallet balance
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    let wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Add coins (via offer reward, admin credit, or payment success)
exports.addCoins = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, type = 'purchase', description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const wallet = await Wallet.findOrCreate({
      where: { userId },
      defaults: { balance: 0 },
     // }).then(([wallet]) => wallet);
    });

    // increment using sequelize method to avoid races
    await wallet.increment('balance', { by: amount });
    await wallet.reload(); // get updated balance

    await WalletTransaction.create({
      userId,
      type,
      amount,
      balanceAfter: wallet.balance,
      description: description || 'Coins added',
    });

    // const updatedWallet = await Wallet.findOne({ where: { userId } });

    res.json({
      success: true,
      message: 'Coins added successfully',
      // newBalance: updatedWallet.balance,
      newBalance: wallet.balance,
    });
  } catch (error) {
    console.error('Error adding coins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Spend coins (call or gift)
exports.spendCoins = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, type = 'call_spend', description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct balance
    await wallet.decrement('balance', { by: amount });

    // Fetch updated balance
    const updatedWallet = await Wallet.findOne({ where: { userId } });

    // Create transaction record with balanceAfter
    await WalletTransaction.create({
      userId,
      type,
      amount: -amount,
      description: description || 'Coins spent',
      balanceAfter: updatedWallet.balance, // 👈 This fixes the notNull violation
    });

    res.json({
      success: true,
      message: 'Coins spent successfully',
      newBalance: updatedWallet.balance,
    });
  } catch (error) {
    console.error('Error spending coins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Admin adjust (add or remove manually)
exports.adminAdjustBalance = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;

    if (!userId || typeof amount !== 'number') {
      return res.status(400).json({ error: 'userId and amount required' });
    }

    // const wallet = await Wallet.findOrCreate({
    //   where: { userId },
    //   defaults: { balance: 0 },
    // }).then(([wallet]) => wallet);

    const [wallet] = await Wallet.findOrCreate({
      where: { userId },
      defaults: { balance: 0 },
    });

    if (amount > 0) {
      await wallet.increment('balance', { by: amount });
    } else {
      // amount is negative
      if (wallet.balance + amount < 0)
        return res.status(400).json({ error: 'Insufficient balance for debit' });
      await wallet.decrement('balance', { by: Math.abs(amount) });
    }

    await wallet.reload();

    await WalletTransaction.create({
      userId,
      type: 'admin_adjust',
      amount,
      balanceAfter: wallet.balance,
      description: description || 'Admin adjustment',
    });

    // const updatedWallet = await Wallet.findOne({ where: { userId } });

    res.json({
      success: true,
      message: 'Wallet adjusted successfully',
      // newBalance: updatedWallet.balance,
      newBalance: wallet.balance,
    });
  } catch (error) {
    console.error('Error adjusting wallet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.listWallets = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;

    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { id: isNaN(Number(search)) ? -1 : Number(search) },
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      where: userWhere,
      include: [{ model: Wallet, as: 'wallet', attributes: ['balance', 'updatedAt'] }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
    });

    // summary values for dashboard cards
    const totalCoinsRow = await Wallet.sum('balance') || 0;
    const totalUsersWithWallets = await Wallet.count();
    res.json({
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      users: rows,
      summary: {
        totalCoins: totalCoinsRow,
        usersWithWallets: totalUsersWithWallets,
      },
    });
  } catch (err) {
    console.error('listWallets error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    const { rows, count } = await WalletTransaction.findAndCountAll({
      where: { userId },
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
  } catch (err) {
    console.error('getUserTransactions error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};