// src/models/walletTransaction.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletTransaction = sequelize.define('WalletTransaction', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true 
    },
    userId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    type: {
        type: DataTypes.ENUM(
        'purchase',
        'call_spend',
        'gift',
        'admin_adjust',
        'bonus',
        'refund',
        'offer_bonus'
        ),
        allowNull: false,
    },
    amount: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    balanceAfter: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    description: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    refId: { 
        type: DataTypes.INTEGER, 
        allowNull: true 
    },
    refType: { 
        type: DataTypes.STRING, 
        allowNull: true 
    }, 
}, {
  tableName: 'wallet_transactions',
  timestamps: true,
});

WalletTransaction.associate = (models) => {
  WalletTransaction.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = WalletTransaction;
