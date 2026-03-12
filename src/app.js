const express    = require('express');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const callRoutes = require('./routes/agoraCallRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminCallRoutes = require('./routes/adminCallRoutes');
const offerRoutes = require('./routes/offerRoutes');
const walletRoutes = require('./routes/walletRoutes');
const walletTransactionRoutes = require('./routes/walletTransactionRoutes');
const coinPackage = require('./routes/coinPackageRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const callRatesRoutes = require('./routes/callRatesRoutes');
const callBillingRoutes = require('./routes/callBillingRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const cors = require('cors');

const app = express();

app.use(cors());

app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/profile', profileRoutes);
app.use('/wallet', walletRoutes);
app.use('/wallet/transactions', walletTransactionRoutes);
app.use('/call', callRoutes);
app.use('/admin', adminAuthRoutes);
app.use('/admin/users', adminUserRoutes);
app.use('/reports', reportRoutes);
app.use('/admin/call', adminCallRoutes);
app.use('/offer', offerRoutes);
app.use('/packages', coinPackage);
app.use('/purchase-orders', purchaseOrderRoutes);
app.use('/call-rates', callRatesRoutes);
app.use('/admin/dashboard', adminDashboardRoutes);
app.use('/', callBillingRoutes);

app.use('/notifications', notificationRoutes);

module.exports = app;
