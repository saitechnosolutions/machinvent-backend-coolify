// src/models/wallet.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  userId: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    unique: true 
  },
  balance: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0, 
    allowNull: false 
  },
  lastUpdated: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW 
  },
}, {
  tableName: 'wallets',
  timestamps: true,
});

Wallet.associate = (models) => {
  Wallet.belongsTo(models.User, { foreignKey: 'userId' });
  Wallet.hasMany(models.WalletTransaction, { foreignKey: 'userId' });
};

module.exports = Wallet;
