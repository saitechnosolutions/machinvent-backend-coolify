// models/Admin.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false, 
  },
  role: {
    type: DataTypes.ENUM('superadmin', 'admin'),
    defaultValue: 'admin',
  },
  lastLogin: {
    type: DataTypes.DATE,
  }
}, {
  tableName: 'admins',
  timestamps: true,
  paranoid: true,
});

module.exports = Admin;
