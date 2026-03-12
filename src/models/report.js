const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./userModel');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  reported_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reported_user: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reason: {
    type: DataTypes.ENUM('spam', 'abuse', 'harassment', 'inappropriate content', 'hate speech', 'fake account', 'scam', 'other'),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'action_taken'),
    defaultValue: 'pending',
    allowNull: false,
  },
}, {
  tableName: 'reports',
  timestamps: true,
  paranoid: true,
});

// Associations
Report.belongsTo(User, { as: 'reporter', foreignKey: 'reported_by', onDelete: 'CASCADE', });
Report.belongsTo(User, { as: 'reported', foreignKey: 'reported_user', onDelete: 'CASCADE', });

module.exports = Report;
