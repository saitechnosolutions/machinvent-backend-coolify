// src/models/callRates.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CallRates = sequelize.define('CallRates', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true 
    },
    type: { 
        type: DataTypes.ENUM('audio', 'video'), 
        allowNull: false 
    },
    rate: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    }, 
}, {
tableName: 'call_rates',
timestamps: true,
paranoid: true
});

module.exports = CallRates;
