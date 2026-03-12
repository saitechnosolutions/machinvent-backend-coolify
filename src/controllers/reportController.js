const { Report, User } = require('../models/index');
const { Op } = require("sequelize");
const { Sequelize } = require('sequelize');

// Submit a new report
exports.createReport = async (req, res) => {
  try {
    console.log('createReport called');
    const { reported_user, reason, description } = req.body;
    console.log('Request body:', { reported_user, reason, description });

    if (!reported_user || !reason) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Reported user and reason are required.' });
    }

    console.log(`Checking for existing pending report by user ${req.user.id} against ${reported_user}`);
    const existingReport = await Report.findOne({
      where: {
        reported_by: req.user.id,
        reported_user: reported_user,
        status: 'pending'
      }
    });

    if (existingReport) {
      console.log('Existing pending report found:', existingReport.toJSON());
      return res.status(400).json({ error: 'You have already reported this user and it is under review.' });
    }

    console.log('No existing report found. Creating new report...');
    const report = await Report.create({
      reported_by: req.user.id,
      reported_user,
      reason,
      description,
    });

    console.log('Report created successfully:', report.toJSON());
    return res.status(201).json({ message: 'Report submitted successfully.', report });
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// List pending reports (admin only)
exports.listReports = async (req, res) => {
  try {
    // Extract query params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { status, search, startDate, endDate } = req.query;

    // Build WHERE conditions
    const where = {};

    // Status filter
    if (status && status !== "all") {
      where.status = status;
    }

    // Date range filter
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Search filter (across reason, reporter name, reported name)
    const searchCondition = search
      ? {
          [Op.or]: [
            Sequelize.where(
              Sequelize.cast(Sequelize.col("Report.reason"), "TEXT"),
              { [Op.iLike]: `%${search}%` }
            ),

            { "$reporter.name$": { [Op.iLike]: `%${search}%` } },
            { "$reported.name$": { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    // Combine where + search conditions
    const finalWhere = {
      ...where,
      ...searchCondition,
    };

    // Count total matching records
    const total = await Report.count({
      where: finalWhere,
      include: [
        { model: User, as: "reporter", attributes: [] },
        { model: User, as: "reported", attributes: [] },
      ],
    });

    // Fetch paginated + filtered reports
    const reports = await Report.findAll({
      where: finalWhere,
      include: [
        { model: User, as: "reporter", attributes: ["id", "name", "email"] },
        { model: User, as: "reported", attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      data: reports,
      meta: {
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// Update report status (mark reviewed, action taken)
exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['reviewed', 'action_taken', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status update.' });
    }

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    report.status = status;
    await report.save();

    return res.json({ message: 'Report updated successfully.', report });
  } catch (error) {
    console.error("Error updating report:", error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// delete report
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the report by ID
    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Perform soft delete by setting deletedAt
    await report.destroy({ force: true });
    return res.json({ message: 'Report deleted successfully.' });
  } catch (error) {
    console.error('Error deleting report:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};