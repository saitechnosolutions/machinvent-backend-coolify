// src/models/offerUser.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OfferUser = sequelize.define('OfferUser', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true
    },
    offerId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: {
            model: 'offers',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    userId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
}, {
  tableName: 'offer_users',
  timestamps: true,
});

module.exports = OfferUser;
