// src/models/coinPackage.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CoinPackage = sequelize.define('CoinPackage', {
    id: { 
        type: DataTypes.INTEGER,
        autoIncrement: true, 
        primaryKey: true 
    },
    name: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    price: { 
        type: DataTypes.FLOAT, 
        allowNull: false 
    },
    coins: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    }  
}, {
  tableName: 'coin_packages',
  timestamps: true
});

module.exports = CoinPackage;
