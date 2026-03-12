const { Offer, OfferUser, User } = require('../models');
const { Op } = require('sequelize');

// --------------------
// Admin: Create Offer
// --------------------
exports.createOffer = async (req, res) => {
  try {
    const { name, type, value, targetType, validFrom, validTo, userIds } = req.body;

    if (!name || !type || !value || !validFrom || !validTo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ✅ Validate user IDs (if selected_users)
    if (targetType === 'selected_users' && Array.isArray(userIds) && userIds.length) {
      const existingUsers = await User.findAll({
        where: { id: userIds },
        attributes: ['id'],
      });
      const existingIds = existingUsers.map(u => u.id);

      const invalidIds = userIds.filter(id => !existingIds.includes(id));
      if (invalidIds.length) {
        return res.status(400).json({
          error: `Invalid user IDs: ${invalidIds.join(', ')}`,
        });
      }
    }

    // ✅ Create offer
    const offer = await Offer.create({
      name, type, value, targetType, validFrom, validTo, isActive: true
    });

    // ✅ Assign users if selected
    if (targetType === 'selected_users' && Array.isArray(userIds) && userIds.length) {
      const bulk = userIds.map(uid => ({ offerId: offer.id, userId: uid }));
      await OfferUser.bulkCreate(bulk);
    }

    // ✅ Return offer with assigned users
    const createdOffer = await Offer.findByPk(offer.id, {
      include: [
        {
          model: OfferUser,
          as: 'assignedUsers',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    res.json({ success: true, offer: createdOffer });
  } catch (error) {
    console.error('Create Offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --------------------
// Admin: List Offers
// --------------------
exports.listOffers = async (req, res) => {
  try {
    const offers = await Offer.findAll({
      include: [
        {
          model: OfferUser,
          as: 'assignedUsers',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, offers });
  } catch (error) {
    console.error('List Offers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --------------------
// Admin: Update Offer
// --------------------
exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, value, targetType, validFrom, validTo, isActive, userIds } = req.body;

    const offer = await Offer.findByPk(id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    // ✅ Validate user IDs if targetType = selected_users
    if (targetType === 'selected_users' && Array.isArray(userIds) && userIds.length) {
      const existingUsers = await User.findAll({
        where: { id: userIds },
        attributes: ['id'],
      });
      const existingIds = existingUsers.map(u => u.id);
      const invalidIds = userIds.filter(id => !existingIds.includes(id));
      if (invalidIds.length) {
        return res.status(400).json({
          error: `Invalid user IDs: ${invalidIds.join(', ')}`,
        });
      }
    }

    await offer.update({ name, type, value, targetType, validFrom, validTo, isActive });

    // ✅ Refresh assigned users
    if (targetType === 'selected_users' && Array.isArray(userIds)) {
      await OfferUser.destroy({ where: { offerId: id } });
      const bulk = userIds.map(uid => ({ offerId: id, userId: uid }));
      await OfferUser.bulkCreate(bulk);
    }

    // ✅ Return updated offer with assigned users
    const updatedOffer = await Offer.findByPk(offer.id, {
      include: [
        {
          model: OfferUser,
          as: 'assignedUsers',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    res.json({ success: true, offer: updatedOffer });
  } catch (error) {
    console.error('Update Offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --------------------
// Admin: Delete Offer
// --------------------
exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findByPk(id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    await OfferUser.destroy({ where: { offerId: id } });
    await offer.destroy();

    res.json({ success: true, message: 'Offer deleted' });
  } catch (error) {
    console.error('Delete Offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --------------------
// User: Get Active Offers
// --------------------
exports.getActiveOffers = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // Global active offers
    const globalOffers = await Offer.findAll({
      where: {
        isActive: true,
        targetType: 'global',
        validFrom: { [Op.lte]: now },
        validTo: { [Op.gte]: now },
      }
    });

    // User-specific active offers
    const userOffers = await Offer.findAll({
      include: [{
        model: OfferUser,
        as: 'assignedUsers',
        where: { userId }
      }],
      where: {
        isActive: true,
        validFrom: { [Op.lte]: now },
        validTo: { [Op.gte]: now },
      }
    });

    // Merge
    const offers = [...globalOffers, ...userOffers];

    res.json({ success: true, offers });
  } catch (error) {
    console.error('Get Active Offers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
