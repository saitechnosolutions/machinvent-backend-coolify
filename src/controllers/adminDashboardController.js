const { Op, fn, col, literal, Sequelize } = require('sequelize');
const { User, Call, Wallet, WalletTransaction, PurchaseOrder, Offer, CoinPackage, Report } = require('../models');


const msInDay = 24 * 60 * 60 * 1000;


module.exports = {
    // GET /api/admin/overview
    overview: async (req, res) => {
        try {
            // Users counts
            const totalUsers = await User.count();
            const bannedUsers = await User.count({ where: { isBanned: true } });
            const deletedUsers = await User.count({ where: { deletedAt: { [Op.ne]: null } } }); // paranoid
            const onlineUsers = await User.count({ where: { isOnline: true } });


            // Calls
            const totalCalls = await Call.count();
            const totalAudioCalls = await Call.count({ where: { callType: 'audio' } });
            const totalVideoCalls = await Call.count({ where: { callType: 'video' } });


            // Coins / wallets
            const walletsSummary = await Wallet.findAll({
                attributes: [[fn('SUM', col('balance')), 'totalCoins'], [fn('COUNT', col('userId')), 'usersWithWallets']],
                raw: true,
            });
            const totalCoins = walletsSummary && walletsSummary[0] ? Number(walletsSummary[0].totalCoins || 0) : 0;
            const usersWithWallets = walletsSummary && walletsSummary[0] ? Number(walletsSummary[0].usersWithWallets || 0) : 0;


            // Revenue
            const revenueResult = await PurchaseOrder.findAll({
                attributes: [[fn('SUM', col('amount')), 'totalRevenue']],
                where: { status: 'success' },
                raw: true,
            });
            const totalRevenue = revenueResult && revenueResult[0] ? Number(revenueResult[0].totalRevenue || 0) : 0;


            // Reports
            const totalReports = await Report.count();
            const pendingReports = await Report.count({ where: { status: 'pending' } });


            res.json({
                totalUsers,
                bannedUsers,
                deletedUsers,
                onlineUsers,
                totalCalls,
                totalAudioCalls,
                totalVideoCalls,
                totalCoins,
                usersWithWallets,
                totalRevenue,
                totalReports,
                pendingReports,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // GET /api/admin/users?status=active|banned|deleted&page=&limit=
    listUsers: async (req, res) => {
        try {
            const { status, page = 1, limit = 20, q } = req.query;
            const offset = (page - 1) * limit;
            const where = {};


            if (status === 'banned') where.isBanned = true;
            else if (status === 'deleted') where.deletedAt = { [Op.ne]: null };
            else if (status === 'active') where.isBanned = false;


            if (q) {
                where[Op.or] = [
                    { username: { [Op.like]: `%${q}%` } },
                    { email: { [Op.like]: `%${q}%` } },
                ];
            }


            const { count: total, rows: users } = await User.findAndCountAll({
                where,
                attributes: ['id', 'username', 'name', 'email', 'isOnline', 'isBanned', 'createdAt'],
                order: [['createdAt', 'DESC']],
                limit: Number(limit),
                offset: Number(offset),
            });


            res.json({ meta: { total, page: Number(page), limit: Number(limit) }, users });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // GET /api/admin/users/recent?page=1&limit=10
    recentUsers: async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;


            const { count: total, rows: users } = await User.findAndCountAll({
                order: [['createdAt', 'DESC']],
                limit: Number(limit),
                offset: Number(offset),
                attributes: ['id', 'username', 'email', 'createdAt', 'isOnline'],
            });


            res.json({ meta: { total, page: Number(page), limit: Number(limit) }, users });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // GET /api/admin/calls?status=ended,missed&callType=audio,video&page=&limit=
    listCalls: async (req, res) => {
        try {
            const { status, callType, page = 1, limit = 50 } = req.query;
            const offset = (page - 1) * limit;
            const where = {};


            if (status) {
                const statuses = String(status).split(',');
                where.status = { [Op.in]: statuses };
            }
            if (callType) {
                const types = String(callType).split(',');
                where.callType = { [Op.in]: types };
            }


            const { count: total, rows: calls } = await Call.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit: Number(limit),
                offset: Number(offset),
            });


            // return raw calls; client can aggregate by fromUser/toUser
            res.json({ meta: { total, page: Number(page), limit: Number(limit) }, calls });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // GET /api/admin/calls/top?type=caller|receiver&limit=5&range=30d
    topCallersOrReceivers: async (req, res) => {
        try {
            const { type = 'caller', limit = 5, range = '30d' } = req.query;
            const days = Number(String(range).replace('d', '')) || 30;
            const since = new Date(Date.now() - days * msInDay);


            if (!['caller', 'receiver'].includes(type)) return res.status(400).json({ error: 'type must be caller or receiver' });


            const column = type === 'caller' ? 'fromUserId' : 'toUserId';


            const rows = await Call.findAll({
                attributes: [
                    [col(column), 'userId'],
                    [fn('COUNT', col('id')), 'callCount'],
                    [fn('SUM', col('duration')), 'totalDuration'],
                ],
                where: { createdAt: { [Op.gte]: since } },
                group: [col(column)],
                order: [[literal('"callCount"'), 'DESC']],
                limit: Number(limit),
                raw: true,
            });


            res.json({ results: rows });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // GET /api/admin/wallets/summary
    walletsSummary: async (req, res) => {
        try {
            const walletsSummary = await Wallet.findAll({
                attributes: [[fn('SUM', col('balance')), 'totalCoins'], [fn('COUNT', col('userId')), 'usersWithWallets']],
                raw: true,
            });
            const totalCoins = walletsSummary && walletsSummary[0] ? Number(walletsSummary[0].totalCoins || 0) : 0;
            const usersWithWallets = walletsSummary && walletsSummary[0] ? Number(walletsSummary[0].usersWithWallets || 0) : 0;


            res.json({ totalCoins, usersWithWallets });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // GET /api/admin/purchase-orders?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    purchaseOrders: async (req, res) => {
        try {
            const { startDate, endDate, page = 1, limit = 100 } = req.query;
            const offset = (page - 1) * limit;
            const where = {};


            if (startDate && endDate) {
                where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            } else if (startDate) {
                where.createdAt = { [Op.gte]: new Date(startDate) };
            }


            const { count: total, rows: orders } = await PurchaseOrder.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit: Number(limit),
                offset: Number(offset),
            });


            // total revenue all time (success)
            const revenueAllTime = await PurchaseOrder.sum('amount', { where: { status: 'success' } });


            res.json({ meta: { total, page: Number(page), limit: Number(limit) }, revenueAllTime, orders });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },


    // GET /api/admin/offers
    listOffers: async (req, res) => {
        try {
            const { isActive } = req.query;
            const where = {};
            if (typeof isActive !== 'undefined') where.isActive = isActive === 'true';


            const offers = await Offer.findAll({ where, order: [['createdAt', 'DESC']] });
            res.json({ offers });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // GET /api/admin/packages
    listPackages: async (req, res) => {
        try {
            const packages = await CoinPackage.findAll({ order: [['coins', 'DESC']] });
            res.json({ packages });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },


    // GET /api/admin/reports?status=pending&page=1&limit=20
    listReports: async (req, res) => {
        try {
            const { status, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;
            const where = {};
            if (status) where.status = status;


            const { count: total, rows: reports } = await Report.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit: Number(limit),
                offset: Number(offset),
            });


            res.json({ meta: { total, page: Number(page), limit: Number(limit) }, reports });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },

    // new shit

  // GET /api/admin/dashboard/analytics/calls-over-time?period=7d
  callsOverTime: async (req, res) => {
    try {
      const { period = "7d" } = req.query;
      const days = Number(period.replace("d", "")) || 7;
      const since = new Date(Date.now() - days * msInDay);

      const rows = await Call.findAll({
        attributes: [
            [fn("DATE", col("createdAt")), "date"],
            [fn("SUM", literal(`CASE WHEN "Call"."callType"='audio' THEN 1 ELSE 0 END`)), "audioCalls"],
            [fn("SUM", literal(`CASE WHEN "Call"."callType"='video' THEN 1 ELSE 0 END`)), "videoCalls"],
        ],
        where: { createdAt: { [Op.gte]: since } },
        group: [fn("DATE", col("createdAt"))],
        order: [[fn("DATE", col("createdAt")), "ASC"]],
        raw: true,
        });


      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },

  // GET /api/admin/dashboard/analytics/growth
  growth: async (req, res) => {
    try {
      const today = new Date();
      const weekAgo = new Date(Date.now() - 7 * msInDay);
      const monthAgo = new Date(Date.now() - 30 * msInDay);

      const [newUsersToday, newUsersThisWeek, newUsersThisMonth, totalUsers] = await Promise.all([
        User.count({ where: { createdAt: { [Op.gte]: new Date(today.setHours(0, 0, 0, 0)) } } }),
        User.count({ where: { createdAt: { [Op.gte]: weekAgo } } }),
        User.count({ where: { createdAt: { [Op.gte]: monthAgo } } }),
        User.count(),
      ]);

      const churnRate = 5.2; // placeholder — implement from user deletions if available
      const growthRate = totalUsers > 0 ? ((newUsersThisMonth / totalUsers) * 100).toFixed(2) : 0;

      const userGrowthByDay = await User.findAll({
        attributes: [
          [fn("DATE", col("createdAt")), "date"],
          [fn("COUNT", "*"), "count"],
        ],
        where: { createdAt: { [Op.gte]: monthAgo } },
        group: [fn("DATE", col("createdAt"))],
        order: [[fn("DATE", col("createdAt")), "ASC"]],
        raw: true,
      });

      res.json({
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        growthRate: Number(growthRate),
        churnRate,
        userGrowthByDay,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },

  // GET /api/admin/dashboard/analytics/offers-performance
  offersPerformance: async (req, res) => {
    try {
        const offerUsageStats = await Offer.findAll({
        attributes: [
            'id',
            ['name', 'offerName'],
            [fn('COUNT', col('orders.id')), 'usageCount'],
            [fn('SUM', col('orders.amount')), 'revenue'],
        ],
        include: [
            {
            model: PurchaseOrder,
            as: 'orders', // ✅ must match association alias
            attributes: [],
            },
        ],
        group: ['Offer.id'],
        raw: true,
        });

        res.json({ offerUsageStats });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
    },


  // GET /api/admin/dashboard/analytics/coins-economy
  coinsEconomy: async (req, res) => {
    try {
      const [walletAgg, topSpenders] = await Promise.all([
        Wallet.findAll({
          attributes: [
            [fn("SUM", col("balance")), "totalCoinsRemaining"],
            [fn("AVG", col("balance")), "averageCoinsPerUser"],
          ],
          raw: true,
        }),

        WalletTransaction.findAll({
          attributes: ["userId", [fn("SUM", col("amount")), "coinsSpent"]],
          where: { type: "call_spend" },
          group: ["userId"],
          order: [[literal("coinsSpent"), "DESC"]],
          limit: 5,
          raw: true,
        }),
      ]);

      const totalCoinsIssued = await WalletTransaction.sum("amount", { where: { type: "credit" } });
      const totalCoinsSpent = await WalletTransaction.sum("amount", { where: { type: "call_spend" } });

      const totalCoinsRemaining = Number(walletAgg[0]?.totalCoinsRemaining || 0);
      const averageCoinsPerUser = Number(walletAgg[0]?.averageCoinsPerUser || 0);
      const coinSpendingRate =
        totalCoinsIssued > 0 ? ((totalCoinsSpent / totalCoinsIssued) * 100).toFixed(1) : 0;

      res.json({
        totalCoinsIssued,
        totalCoinsSpent,
        totalCoinsRemaining,
        averageCoinsPerUser,
        coinSpendingRate: Number(coinSpendingRate),
        topSpenders,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },

  // GET /api/admin/dashboard/analytics/revenue-breakdown
  revenueBreakdown: async (req, res) => {
  try {
    const revenueByPackage = await CoinPackage.findAll({
      attributes: [
        ["name", "packageName"],
        [
          literal(`SUM((SELECT SUM("amount") FROM purchase_orders WHERE "packageId" = "CoinPackage"."id" AND "status" = 'success'))`),
          "totalRevenue"
        ],
        [
          literal(`COUNT((SELECT "id" FROM purchase_orders WHERE "packageId" = "CoinPackage"."id" AND "status" = 'success'))`),
          "orderCount"
        ],
      ],
      group: ['CoinPackage.id', 'CoinPackage.name'], // 🟢 FIX HERE
      raw: true,
    });

    const revenueByDay = await PurchaseOrder.findAll({
      attributes: [
        [fn("DATE", col("createdAt")), "date"],
        [fn("SUM", col("amount")), "totalRevenue"],
      ],
      where: { status: "success" },
      group: [fn("DATE", col("createdAt"))],
      order: [[fn("DATE", col("createdAt")), "ASC"]],
      raw: true,
    });

    const totalOrders = await PurchaseOrder.count({ where: { status: "success" } });
    const totalUsers = await User.count();

    const conversionRate =
      totalUsers > 0 ? ((totalOrders / totalUsers) * 100).toFixed(1) : 0;

    res.json({
      revenueByPackage,
      revenueByDay,
      conversionRate: Number(conversionRate)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
},



  // GET /api/admin/dashboard/analytics/user-engagement
  userEngagement: async (req, res) => {
    try {
      const now = new Date();
      const dayAgo = new Date(now - msInDay);
      const weekAgo = new Date(now - 7 * msInDay);
      const monthAgo = new Date(now - 30 * msInDay);

      const [dailyActiveUsers, weeklyActiveUsers, monthlyActiveUsers] = await Promise.all([
        User.count({ where: { lastSeen: { [Op.gte]: dayAgo } } }),
        User.count({ where: { lastSeen: { [Op.gte]: weekAgo } } }),
        User.count({ where: { lastSeen: { [Op.gte]: monthAgo } } }),
      ]);

      res.json({ dailyActiveUsers, weeklyActiveUsers, monthlyActiveUsers });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },

  // GET /api/admin/dashboard/analytics/realtime
  realtime: async (req, res) => {
    try {
      const [activeCallsNow, onlineUsers, revenueToday, callsToday, newUsersToday] = await Promise.all([
        Call.count({ where: { status: "accepted" } }),
        User.count({ where: { isOnline: true } }),
        PurchaseOrder.sum("amount", {
          where: {
            status: "success",
            createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        Call.count({
          where: { createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } },
        }),
        User.count({
          where: { createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } },
        }),
      ]);

      res.json({
        activeCallsNow,
        onlineUsers,
        revenueToday: Number(revenueToday) || 0,
        callsToday,
        newUsersToday,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },

};