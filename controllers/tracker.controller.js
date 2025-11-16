const Tracker = require("../models/Tracker");
const Application = require("../models/Application"); // The existing application model
const {validationResult} = require("express-validator");
const moment = require("moment");
const mongoose = require("mongoose");

// @desc    Get all tracked applications for user
// @route   GET /api/tracker
// @access  Private
exports.getTrackedApplications = async (req, res, next) => {
	try {
		const {
			status,
			archived = false,
			sortBy = "-createdAt",
			page = 1,
			limit = 20,
			view = "list", // list, kanban, calendar
		} = req.query;

		let query = {
			user: req.user.id,
			archived: archived === "true",
		};

		if (status && status !== "all") {
			query.status = status;
		}

		// For Kanban view, get all applications grouped by status
		if (view === "kanban") {
			const trackers = await Tracker.find(query).sort(
				"position status " + sortBy
			);

			// Group by status
			const kanbanData = {
				to_apply: [],
				applied: [],
				interview_scheduled: [],
				offer_received: [],
				rejected: [],
				withdrawn: [],
			};

			trackers.forEach((tracker) => {
				if (kanbanData[tracker.status]) {
					kanbanData[tracker.status].push(tracker);
				}
			});

			return res.json({
				success: true,
				data: kanbanData,
				total: trackers.length,
			});
		}

		// For calendar view, get applications with dates
		if (view === "calendar") {
			const {startDate, endDate} = req.query;

			const calendarQuery = {
				...query,
				$or: [
					{"dates.deadline": {$gte: startDate, $lte: endDate}},
					{"interviews.date": {$gte: startDate, $lte: endDate}},
					{"reminders.date": {$gte: startDate, $lte: endDate}},
				],
			};

			const trackers = await Tracker.find(calendarQuery).select(
				"company.name job.title dates interviews reminders status"
			);

			// Format for calendar
			const events = [];

			trackers.forEach((tracker) => {
				// Add deadline events
				if (tracker.dates.deadline) {
					events.push({
						id: `deadline-${tracker._id}`,
						title: `Deadline: ${tracker.job.title} at ${tracker.company.name}`,
						date: tracker.dates.deadline,
						type: "deadline",
						status: tracker.status,
						trackerId: tracker._id,
					});
				}

				// Add interview events
				tracker.interviews.forEach((interview) => {
					if (interview.date) {
						events.push({
							id: `interview-${tracker._id}-${interview._id}`,
							title: `Interview: ${tracker.company.name} - Round ${interview.round}`,
							date: interview.date,
							time: interview.time,
							type: "interview",
							status: tracker.status,
							trackerId: tracker._id,
						});
					}
				});

				// Add reminder events
				tracker.reminders.forEach((reminder) => {
					if (reminder.date && !reminder.completed) {
						events.push({
							id: `reminder-${tracker._id}-${reminder._id}`,
							title: reminder.title,
							date: reminder.date,
							time: reminder.time,
							type: "reminder",
							trackerId: tracker._id,
						});
					}
				});
			});

			return res.json({
				success: true,
				data: events,
			});
		}

		// Default list view with pagination
		const trackers = await Tracker.find(query)
			.populate("platformApplication", "job applicantEmail status")
			.sort(sortBy)
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await Tracker.countDocuments(query);

		res.json({
			success: true,
			data: trackers,
			pagination: {
				total,
				pages: Math.ceil(total / limit),
				current: parseInt(page),
				limit: parseInt(limit),
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get single tracked application
// @route   GET /api/tracker/:id
// @access  Private
exports.getTrackedApplication = async (req, res, next) => {
	try {
		const tracker = await Tracker.findOne({
			_id: req.params.id,
			user: req.user.id,
		}).populate("platformApplication");

		if (!tracker) {
			return res.status(404).json({
				success: false,
				message: "Tracked application not found",
			});
		}

		res.json({
			success: true,
			data: tracker,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Create tracked application
// @route   POST /api/tracker
// @access  Private
// Add this method to prevent students from manually re-adding platform applications
exports.createTrackedApplication = async (req, res, next) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const trackerData = {
			...req.body,
			user: req.user.id,
		};

		// Check if this is a platform job being manually tracked
		if (
			trackerData.metadata?.source === "Platform" ||
			trackerData.platformApplication
		) {
			// Verify it's not already tracked
			const existing = await Tracker.findOne({
				user: req.user.id,
				$or: [
					{platformApplication: trackerData.platformApplication},
					{
						"company.name": trackerData.company.name,
						"job.title": trackerData.job.title,
						"metadata.source": "Platform",
					},
				],
			});

			if (existing) {
				return res.status(400).json({
					success: false,
					message: "This application is already being tracked",
					trackerId: existing._id,
				});
			}
		}

		// If status is 'applied', set the applied date
		if (trackerData.status === "applied" && !trackerData.dates?.applied) {
			trackerData.dates = {
				...trackerData.dates,
				applied: new Date(),
			};
		}

		const tracker = await Tracker.create(trackerData);

		res.status(201).json({
			success: true,
			message: "Application tracking created successfully",
			data: tracker,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Create tracker from platform application
// @route   POST /api/tracker/from-application/:applicationId
// @access  Private
exports.createFromPlatformApplication = async (req, res, next) => {
	try {
		const {applicationId} = req.params;

		// Find the platform application
		const application = await Application.findById(applicationId).populate(
			"job"
		);

		if (!application) {
			return res.status(404).json({
				success: false,
				message: "Application not found",
			});
		}

		// Check if user owns this application or is the applicant
		if (application.applicantEmail !== req.user.email) {
			return res.status(403).json({
				success: false,
				message: "You can only track your own applications",
			});
		}

		// Check if already tracking
		const existingTracker = await Tracker.findOne({
			user: req.user.id,
			platformApplication: applicationId,
		});

		if (existingTracker) {
			return res.status(400).json({
				success: false,
				message: "Already tracking this application",
			});
		}

		// Create tracker from application data
		const trackerData = {
			user: req.user.id,
			platformApplication: applicationId,
			company: {
				name: application.job.company,
				location: application.job.location,
			},
			job: {
				title: application.job.title,
				type: application.job.jobType,
				location: application.job.location,
				description: application.job.description,
			},
			status: "applied", // Since they already applied through platform
			dates: {
				applied: application.appliedAt,
			},
			metadata: {
				source: "Platform",
			},
			documents: {
				resume: {
					url: application.resumeUrl,
					uploadedAt: application.appliedAt,
				},
				coverLetter: application.coverLetter
					? {
							url: application.coverLetter,
							uploadedAt: application.appliedAt,
					  }
					: undefined,
				portfolio: application.portfolioUrl,
			},
		};

		const tracker = await Tracker.create(trackerData);

		res.status(201).json({
			success: true,
			message: "Application added to tracker successfully",
			data: tracker,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Update tracked application
// @route   PUT /api/tracker/:id
// @access  Private
exports.updateTrackedApplication = async (req, res, next) => {
	try {
		let tracker = await Tracker.findOne({
			_id: req.params.id,
			user: req.user.id,
		});

		if (!tracker) {
			return res.status(404).json({
				success: false,
				message: "Tracked application not found",
			});
		}

		// Handle status change
		if (req.body.status && req.body.status !== tracker.status) {
			// Auto-set applied date when moving to 'applied' status
			if (req.body.status === "applied" && !tracker.dates.applied) {
				req.body.dates = {
					...req.body.dates,
					applied: new Date(),
				};
			}
		}

		// Update tracker
		tracker = await Tracker.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});

		res.json({
			success: true,
			message: "Application tracking updated successfully",
			data: tracker,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Update tracked application status (for Kanban drag & drop)
// @route   PATCH /api/tracker/:id/status
// @access  Private
exports.updateTrackedStatus = async (req, res, next) => {
	try {
		const {status, position, notes} = req.body;

		const tracker = await Tracker.findOneAndUpdate(
			{
				_id: req.params.id,
				user: req.user.id,
			},
			{
				status,
				position,
				$push: {
					statusHistory: {
						status,
						date: new Date(),
						notes,
					},
				},
			},
			{
				new: true,
				runValidators: true,
			}
		);

		if (!tracker) {
			return res.status(404).json({
				success: false,
				message: "Tracked application not found",
			});
		}

		res.json({
			success: true,
			message: "Status updated successfully",
			data: tracker,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Delete tracked application
// @route   DELETE /api/tracker/:id
// @access  Private
exports.deleteTrackedApplication = async (req, res, next) => {
	try {
		const tracker = await Tracker.findOneAndDelete({
			_id: req.params.id,
			user: req.user.id,
		});

		if (!tracker) {
			return res.status(404).json({
				success: false,
				message: "Tracked application not found",
			});
		}

		res.json({
			success: true,
			message: "Application tracking deleted successfully",
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Bulk actions (archive, delete)
// @route   POST /api/tracker/bulk
// @access  Private
exports.bulkActions = async (req, res, next) => {
	try {
		const {action, trackerIds} = req.body;

		if (!action || !trackerIds || !Array.isArray(trackerIds)) {
			return res.status(400).json({
				success: false,
				message: "Invalid request",
			});
		}

		let result;

		switch (action) {
			case "archive":
				result = await Tracker.updateMany(
					{
						_id: {$in: trackerIds},
						user: req.user.id,
					},
					{
						archived: true,
					}
				);
				break;

			case "unarchive":
				result = await Tracker.updateMany(
					{
						_id: {$in: trackerIds},
						user: req.user.id,
					},
					{
						archived: false,
					}
				);
				break;

			case "delete":
				result = await Tracker.deleteMany({
					_id: {$in: trackerIds},
					user: req.user.id,
				});
				break;

			default:
				return res.status(400).json({
					success: false,
					message: "Invalid action",
				});
		}

		res.json({
			success: true,
			message: `${action} action completed successfully`,
			affected: result.modifiedCount || result.deletedCount,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get tracking statistics
// @route   GET /api/tracker/stats
// @access  Private
exports.getTrackingStatistics = async (req, res, next) => {
	try {
		const userId = req.user.id;
		const {startDate, endDate, period = "30days"} = req.query;

		// Convert string ID to ObjectId properly
		const userObjectId = new mongoose.Types.ObjectId(userId);

		let dateFilter = {};

		if (startDate && endDate) {
			dateFilter = {
				createdAt: {
					$gte: new Date(startDate),
					$lte: new Date(endDate),
				},
			};
		} else {
			// Default to last 30 days
			const days = period === "7days" ? 7 : period === "90days" ? 90 : 30;
			dateFilter = {
				createdAt: {
					$gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
				},
			};
		}

		// Overall statistics
		const [
			totalTracked,
			statusCounts,
			recentActivity,
			successRate,
			avgResponseTime,
			upcomingDeadlines,
			upcomingInterviews,
		] = await Promise.all([
			// Total tracked applications
			Tracker.countDocuments({user: userId, ...dateFilter}),

			// Applications by status - Fixed ObjectId usage
			Tracker.aggregate([
				{$match: {user: userObjectId, ...dateFilter}},
				{
					$group: {
						_id: "$status",
						count: {$sum: 1},
					},
				},
			]),

			// Recent activity (last 7 days)
			Tracker.find({
				user: userId,
				"dates.lastUpdated": {
					$gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
				},
			})
				.limit(10)
				.sort("-dates.lastUpdated"),

			// Success rate calculation - Fixed ObjectId usage
			Tracker.aggregate([
				{$match: {user: userObjectId, ...dateFilter}},
				{
					$group: {
						_id: null,
						total: {$sum: 1},
						offers: {
							$sum: {
								$cond: [{$eq: ["$status", "offer_received"]}, 1, 0],
							},
						},
						interviews: {
							$sum: {
								$cond: [{$eq: ["$status", "interview_scheduled"]}, 1, 0],
							},
						},
					},
				},
			]),

			// Average response time (from applied to first response) - Fixed ObjectId usage
			Tracker.aggregate([
				{
					$match: {
						user: userObjectId,
						"dates.applied": {$exists: true},
						"statusHistory.1": {$exists: true},
					},
				},
				{
					$project: {
						responseTime: {
							$subtract: [
								{$arrayElemAt: ["$statusHistory.date", 1]},
								"$dates.applied",
							],
						},
					},
				},
				{
					$group: {
						_id: null,
						avgResponseTime: {$avg: "$responseTime"},
					},
				},
			]),

			// Upcoming deadlines (next 7 days)
			Tracker.find({
				user: userId,
				"dates.deadline": {
					$gte: new Date(),
					$lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				},
			})
				.sort("dates.deadline")
				.limit(5),

			// Upcoming interviews
			Tracker.find({
				user: userId,
				"interviews.date": {
					$gte: new Date(),
				},
			})
				.sort("interviews.date")
				.limit(5),
		]);

		// Format status counts
		const statusMap = {
			to_apply: {count: 0, color: "#6B7280", label: "To Apply"},
			applied: {count: 0, color: "#3B82F6", label: "Applied"},
			interview_scheduled: {count: 0, color: "#F59E0B", label: "Interview"},
			offer_received: {count: 0, color: "#10B981", label: "Offer"},
			rejected: {count: 0, color: "#EF4444", label: "Rejected"},
			withdrawn: {count: 0, color: "#FB923C", label: "Withdrawn"},
		};

		statusCounts.forEach((item) => {
			if (statusMap[item._id]) {
				statusMap[item._id].count = item.count;
			}
		});

		// Calculate rates
		const successData = successRate[0] || {total: 0, offers: 0, interviews: 0};
		const offerRate = successData.total
			? ((successData.offers / successData.total) * 100).toFixed(1)
			: 0;
		const interviewRate = successData.total
			? (
					((successData.offers + successData.interviews) / successData.total) *
					100
			  ).toFixed(1)
			: 0;

		// Format average response time
		const avgResponse = avgResponseTime[0]?.avgResponseTime;
		const avgResponseDays = avgResponse
			? Math.round(avgResponse / (1000 * 60 * 60 * 24))
			: null;

		// Application trend (daily for last 30 days) - Fixed ObjectId usage
		const trendData = await Tracker.aggregate([
			{
				$match: {
					user: userObjectId,
					createdAt: {
						$gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
					},
				},
			},
			{
				$group: {
					_id: {
						$dateToString: {format: "%Y-%m-%d", date: "$createdAt"},
					},
					count: {$sum: 1},
				},
			},
			{$sort: {_id: 1}},
		]);

		res.json({
			success: true,
			data: {
				overview: {
					total: totalTracked,
					offerRate,
					interviewRate,
					avgResponseDays,
				},
				statusBreakdown: statusMap,
				trend: trendData,
				recentActivity,
				upcomingDeadlines,
				upcomingInterviews,
			},
		});
	} catch (error) {
		console.error("Statistics error:", error);
		res.status(500).json({
			success: false,
			message: "Error fetching statistics",
			error: error.message,
		});
	}
};

// @desc    Add reminder
// @route   POST /api/tracker/:id/reminders
// @access  Private
exports.addReminder = async (req, res, next) => {
	try {
		const {type, title, description, date, time} = req.body;

		const tracker = await Tracker.findOneAndUpdate(
			{
				_id: req.params.id,
				user: req.user.id,
			},
			{
				$push: {
					reminders: {
						type,
						title,
						description,
						date,
						time,
						completed: false,
					},
				},
			},
			{
				new: true,
				runValidators: true,
			}
		);

		if (!tracker) {
			return res.status(404).json({
				success: false,
				message: "Tracked application not found",
			});
		}

		res.json({
			success: true,
			message: "Reminder added successfully",
			data: tracker,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Export tracked applications to CSV
// @route   GET /api/tracker/export
// @access  Private
exports.exportTrackedApplications = async (req, res, next) => {
	try {
		const trackers = await Tracker.find({
			user: req.user.id,
		}).sort("-createdAt");

		// Convert to CSV format
		const csv = [
			[
				"Company",
				"Job Title",
				"Status",
				"Date Applied",
				"Deadline",
				"Location",
				"Type",
				"Notes",
			],
			...trackers.map((tracker) => [
				tracker.company.name,
				tracker.job.title,
				tracker.status,
				tracker.dates.applied
					? moment(tracker.dates.applied).format("YYYY-MM-DD")
					: "",
				tracker.dates.deadline
					? moment(tracker.dates.deadline).format("YYYY-MM-DD")
					: "",
				tracker.job.location || "",
				tracker.job.type || "",
				tracker.notes.general || "",
			]),
		]
			.map((row) => row.join(","))
			.join("\n");

		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			'attachment; filename="tracked-applications.csv"'
		);
		res.send(csv);
	} catch (error) {
		next(error);
	}
};
