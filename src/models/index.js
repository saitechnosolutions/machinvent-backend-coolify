// src/model/index.js
const sequelize = require('../config/database');
const User = require('./userModel');
const Otp = require('./Otp');
const Wallet = require('./wallet');
const WalletTransaction = require('./wallettransaction');
const Call = require('./calls');
const Admin = require('./admin');
const Report = require('./report');
const Offer = require('./offer');
const OfferUser = require('./offerUser');
const CoinPackage = require('./coinPackage');
const PurchaseOrder = require('./purchaseOrder');
const CallRates = require('./callRates');

const db = {};
db.sequelize = sequelize;
db.User = User;
db.Otp = Otp;
db.Wallet = Wallet;
db.WalletTransaction = WalletTransaction;
db.Call = Call;
db.Admin = Admin;
db.Report = Report;
db.Offer = Offer;
db.OfferUser = OfferUser;
db.CoinPackage = CoinPackage;   
db.PurchaseOrder = PurchaseOrder;
db.CallRates = CallRates;

Call.belongsTo(User, { as: 'fromUser', foreignKey: 'fromUserId', onDelete: 'CASCADE', });
Call.belongsTo(User, { as: 'toUser', foreignKey: 'toUserId', onDelete: 'CASCADE', });

// ✅ Wallet relations
User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE', });

// ✅ Wallet ↔ WalletTransaction
User.hasMany(WalletTransaction, { foreignKey: 'userId', as: 'transactions' });
WalletTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE', });
Wallet.hasMany(WalletTransaction, { foreignKey: 'userId', as: 'walletTransactions' });

// ✅ Offer ↔ OfferUser (One Offer has many OfferUsers)
Offer.hasMany(OfferUser, { foreignKey: 'offerId', as: 'assignedUsers' });
OfferUser.belongsTo(Offer, { foreignKey: 'offerId', as: 'offer' });

// ✅ User ↔ OfferUser (One User can have many OfferUsers)
User.hasMany(OfferUser, { foreignKey: 'userId', as: 'userOffers' });
OfferUser.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE', });

User.hasMany(PurchaseOrder, { foreignKey: 'userId', as: 'purchaseOrders' });
PurchaseOrder.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE', });

CoinPackage.hasMany(PurchaseOrder, { foreignKey: 'packageId', as: 'orders' });
PurchaseOrder.belongsTo(CoinPackage, { foreignKey: 'packageId', as: 'package' });

Offer.hasMany(PurchaseOrder, { foreignKey: 'offerId', as: 'orders' });
PurchaseOrder.belongsTo(Offer, { foreignKey: 'offerId', as: 'offer' });

module.exports = { sequelize, User, Otp, Wallet, WalletTransaction, Call, Admin, Report, Offer, OfferUser, CoinPackage, PurchaseOrder, CallRates };
