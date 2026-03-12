// src/models/offer.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Offer = sequelize.define('Offer', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true 
    },
    name: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    type: { 
        type: DataTypes.ENUM('bonus_coins', 'discount_call_rate'), 
        allowNull: false 
    },
    value: { 
        type: DataTypes.FLOAT, 
        allowNull: false 
    }, 
    targetType: { 
        type: DataTypes.ENUM('global', 'selected_users'), 
        defaultValue: 'global' 
    },
    validFrom: { 
        type: DataTypes.DATE, 
        allowNull: false 
    },
    validTo: { 
        type: DataTypes.DATE, 
        allowNull: false 
    },
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
    },
}, {
tableName: 'offers',
timestamps: true,
});

module.exports = Offer;
