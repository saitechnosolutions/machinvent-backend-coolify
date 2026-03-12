// src/models/call.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Call = sequelize.define('Call', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fromUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    toUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    channelName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    callType: {
      type: DataTypes.ENUM('audio', 'video'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('missed', 'accepted', 'rejected', 'cancelled', 'ended'),
      defaultValue: 'missed',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    callerRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    callerComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    receiverRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    receiverComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

  }, {
    tableName: 'calls',
    timestamps: true,
    paranoid: true,
});

module.exports = Call;
