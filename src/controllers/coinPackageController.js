const { CoinPackage } = require('../models');

// --------------------
// Admin: Create Package
// --------------------
exports.createPackage = async (req, res) => {
  try {
    const { name, price, coins } = req.body;
    if (!name || !price || !coins) return res.status(400).json({ error: 'Missing fields' });

    const pkg = await CoinPackage.create({ name, price, coins });
    res.json({ success: true, package: pkg });
  } catch (error) {
    console.error('Create CoinPackage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --------------------
// Admin: List Packages
// --------------------
exports.listPackages = async (req, res) => {
  try {
    const packages = await CoinPackage.findAll({ order: [['coins', 'ASC']] });
    res.json({ success: true, packages });
  } catch (error) {
    console.error('List CoinPackages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --------------------
// Admin: Update Package
// --------------------
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, coins } = req.body;
    const pkg = await CoinPackage.findByPk(id);
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    await pkg.update({ name, price, coins });
    res.json({ success: true, package: pkg });
  } catch (error) {
    console.error('Update CoinPackage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --------------------
// Admin: Delete Package
// --------------------
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await CoinPackage.findByPk(id);
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    await pkg.destroy();
    res.json({ success: true, message: 'Package deleted' });
  } catch (error) {
    console.error('Delete CoinPackage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// User: Get all coin packages
exports.getActivePackages = async (req, res) => {
  try {
    // For now, all packages are available
    // You could filter for "active" flag in future if needed
    const packages = await CoinPackage.findAll({ order: [['coins', 'ASC']] });
    res.json({ success: true, packages });
  } catch (error) {
    console.error('Get Active CoinPackages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
