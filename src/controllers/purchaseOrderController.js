// src/controllers/purchaseOrderController.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { PurchaseOrder, CoinPackage, Wallet, WalletTransaction, Offer, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// 🔑 Setup Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});0

// 🟢 Create Order
exports.createOrder = async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;

    const pkg = await CoinPackage.findByPk(packageId);
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const razorpayOrder = await razorpay.orders.create({
      amount: pkg.price * 100,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    const purchase = await PurchaseOrder.create({
      userId,
      packageId,
      amount: pkg.price,
      coins: pkg.coins,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending',
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: pkg.price,
      currency: 'INR',
      purchaseId: purchase.id,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// 🟢 Verify Payment
exports.verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, signature } = req.body;
  const userId = req.user.id;

  try {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature)
      return res.status(400).json({ error: 'Invalid signature' });

    const order = await PurchaseOrder.findOne({ where: { razorpayOrderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'success') {
      return res.json({ success: true, message: 'Payment already processed' });
    }

    // 🔍 Find the highest active bonus offer (if any)
    const now = new Date();
    const offers = await Offer.findAll({
      where: {
        isActive: true,
        type: 'bonus_coins',
        validFrom: { [Op.lte]: now },
        validTo: { [Op.gte]: now },
      },
    });

    const bestOffer = offers.length
      ? offers.reduce((max, o) => (o.value > max.value ? o : max))
      : null;

    const bonusCoins = bestOffer ? Math.floor(order.coins * (bestOffer.value / 100)) : 0;
    const totalCoins = order.coins + bonusCoins;

    await sequelize.transaction(async (t) => {
      // 🟢 Update purchase order
      order.razorpayPaymentId = razorpayPaymentId;
      order.status = 'success';
      order.bonusCoins = bonusCoins;
      order.offerId = bestOffer ? bestOffer.id : null;
      order.completedAt = new Date();
      await order.save({ transaction: t });

      // 🪙 Update wallet balance
      let wallet = await Wallet.findOne({ where: { userId }, transaction: t });
      if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0 }, { transaction: t });
      }
      wallet.balance += totalCoins;
      await wallet.save({ transaction: t });

      // 📜 Record wallet transaction
      await WalletTransaction.create({
        userId,
        type: bestOffer ? 'offer_bonus' : 'purchase',
        amount: totalCoins,
        balanceAfter: wallet.balance,
        description: bestOffer
          ? `Purchased package ${order.packageId} with ${bestOffer.value}% bonus`
          : `Purchased package ${order.packageId}`,
        refId: order.id,
        refType: 'PurchaseOrder',
      }, { transaction: t });
    });

    res.json({
      success: true,
      coinsAdded: order.coins,
      bonusCoins,
      totalCoins,
      appliedOffer: bestOffer
        ? { id: bestOffer.id, name: bestOffer.name, value: bestOffer.value }
        : null,
    });
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
};

// 🟢 (Optional) List User Orders
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrder.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      include: [{ model: CoinPackage, attributes: ['name', 'coins', 'price'] }],
    });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// 🟢 (Optional) Razorpay Webhook
exports.webhook = async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-razorpay-signature'];

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== signature)
      return res.status(400).json({ error: 'Invalid webhook signature' });

    if (payload.event === 'payment.captured') {
      const razorpayPaymentId = payload.payload.payment.entity.id;
      const razorpayOrderId = payload.payload.payment.entity.order_id;

      const order = await PurchaseOrder.findOne({ where: { razorpayOrderId } });
      if (order && order.status !== 'success') {
        // Optionally call verifyPayment logic here
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, startDate, endDate, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (startDate && endDate) where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    const include = [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email'],
        required: false,
        where: search
          ? {
              [Op.or]: [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
              ],
            }
          : undefined,
      },
      { model: CoinPackage, as: 'package', attributes: ['id', 'name', 'coins', 'price'], required: false },
      { model: Offer, as: 'offer', attributes: ['id', 'type', 'value'], required: false },
    ];

    const { rows, count } = await PurchaseOrder.findAndCountAll({
      where,
      include,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // optional summary revenue
    const totalRevenue = await PurchaseOrder.sum('amount', { where: { status: 'success' } }) || 0;

    res.json({
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      orders: rows,
      summary: { totalRevenue },
    });
  } catch (err) {
    console.error('getAllPurchaseOrders error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.refundOrder = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    await sequelize.transaction(async (t) => {
      const order = await PurchaseOrder.findByPk(id, { transaction: t });
      if (!order) throw new Error('Order not found');
      if (order.status !== 'success') throw new Error('Only success orders can be refunded');
      if (!order.razorpayPaymentId) throw new Error('Missing Razorpay payment ID for this order');

      const userId = order.userId;
      const totalCoins = (order.coins || 0) + (order.bonusCoins || 0);

      // 🔹 Step 1: Call Razorpay refund API
      const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: order.amount * 100, // in paise
        speed: 'optimum',
        notes: { reason: reason || 'Admin initiated refund' },
      });

      // 🔹 Step 2: Update user's wallet (deduct refunded coins)
      const wallet = await Wallet.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!wallet) throw new Error('User wallet not found');
      if (wallet.balance < totalCoins)
        throw new Error('Insufficient coins in user wallet to refund');

      await wallet.decrement('balance', { by: totalCoins, transaction: t });
      await wallet.reload({ transaction: t });

      // 🔹 Step 3: Log wallet transaction
      await WalletTransaction.create(
        {
          userId,
          type: 'refund',
          amount: -totalCoins,
          balanceAfter: wallet.balance,
          description: `Refund for order ${order.id}. Reason: ${reason || 'admin'}`,
          refId: order.id,
          refType: 'PurchaseOrder',
        },
        { transaction: t }
      );

      // 🔹 Step 4: Update order status + refund tracking
      order.status = 'refunded';
      order.refundId = refund.id;
      order.refundReason = reason || 'admin';
      order.refundedAt = new Date();
      await order.save({ transaction: t });
    });

    res.json({ success: true, message: 'Order refunded successfully' });
  } catch (err) {
    console.error('refundOrder error', err);
    res.status(400).json({ error: err.message || 'Refund failed' });
  }
};
