const CallRates = require('../models/callRates');
const { Offer } = require('../models');
const { Op } = require('sequelize');

// ✅ Create new call rate (admin only)
exports.createCallRate = async (req, res) => {
  try {
    const { type, rate } = req.body;

    // Check if already exists (not deleted)
    const existing = await CallRates.findOne({ where: { type } });
    if (existing) {
      return res.status(400).json({ message: `Call rate for ${type} already exists` });
    }

    const newRate = await CallRates.create({ type, rate });
    res.status(201).json({ message: 'Call rate created successfully', data: newRate });
  } catch (error) {
    console.error('Error creating call rate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ Get all call rates (admin)
exports.getAllCallRates = async (req, res) => {
  try {
    const rates = await CallRates.findAll({ order: [['type', 'ASC']] });
    res.status(200).json({ data: rates });
  } catch (error) {
    console.error('Error fetching call rates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ Update call rate (admin)
exports.updateCallRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { rate } = req.body;

    const callRate = await CallRates.findByPk(id);
    if (!callRate) {
      return res.status(404).json({ message: 'Call rate not found' });
    }

    callRate.rate = rate;
    await callRate.save();

    res.status(200).json({ message: 'Call rate updated successfully', data: callRate });
  } catch (error) {
    console.error('Error updating call rate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ Soft delete call rate (admin)
exports.deleteCallRate = async (req, res) => {
  try {
    const { id } = req.params;

    const callRate = await CallRates.findByPk(id);
    if (!callRate) {
      return res.status(404).json({ message: 'Call rate not found' });
    }

    await callRate.destroy();
    res.status(200).json({ message: 'Call rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting call rate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getUserCallRates = async (req, res) => {
  try {
    const userId = req.user?.id;

    // 1️⃣ Get base call rates
    const rates = await CallRates.findAll({
      attributes: ['type', 'rate'],
      order: [['type', 'ASC']],
    });

    const formatted = {};
    rates.forEach(r => {
      formatted[r.type] = r.rate;
    });

    // 2️⃣ Apply discount offers if user is authenticated
    if (userId) {
      try {
        const now = new Date();

        // Fetch all active global discount offers
        const globalOffers = await Offer.findAll({
          where: {
            isActive: true,
            type: 'discount_call_rate',
            targetType: 'global',
            validFrom: { [Op.lte]: now },
            validTo: { [Op.gte]: now },
          },
        });

        // Fetch all active user-specific discount offers
        const userOffers = await Offer.findAll({
          where: {
            isActive: true,
            type: 'discount_call_rate',
            targetType: 'selected_users',
            validFrom: { [Op.lte]: now },
            validTo: { [Op.gte]: now },
          },
          include: [{
            model: require('../models/offerUser'),
            as: 'assignedUsers',
            where: { userId },
            required: true,
          }],
        });

        // Combine both and get the best offer (highest discount %)
        const allOffers = [...globalOffers, ...userOffers];
        const bestOffer = allOffers.sort((a, b) => b.value - a.value)[0];

        if (bestOffer) {
          const discountPercentage = bestOffer.value / 100;

          // Apply discount to available rates
          if (formatted.audio) {
            formatted.audio = Math.round(formatted.audio * (1 - discountPercentage));
          }
          if (formatted.video) {
            formatted.video = Math.round(formatted.video * (1 - discountPercentage));
          }

          // Add discount info to response
          formatted.discountApplied = {
            offerId: bestOffer.id,
            discountPercentage: bestOffer.value,
            offerName: bestOffer.name,
          };
        }

      } catch (offerError) {
        console.log('Error applying discount offers:', offerError);
        // Continue with base rates if offer application fails
      }
    }

    // 3️⃣ Return result
    res.status(200).json({ data: formatted });

  } catch (error) {
    console.error('Error fetching user call rates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
