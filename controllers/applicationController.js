const Application = require("../models/Application");
const Job = require("../models/Job");
const Tracker = require("../models/Tracker");
// @desc    Submit job application
// @route   POST /api/applications
// @access  Public
exports.submitApplication = async (req, res, next) => {
	try {
		const {job: jobId} = req.body;

		// Check if job exists and is active
		const job = await Job.findById(jobId);

		if (!job) {
			return res.status(404).json({
				success: false,
				message: "Job not found",
			});
		}

		if (!job.isActive) {
			return res.status(400).json({
				success: false,
				message: "Job posting is no longer active",
			});
		}

		// Check if application deadline has passed
		if (job.isExpired()) {
			return res.status(400).json({
				success: false,
				message: "Application deadline has passed",
			});
		}

		// Check for duplicate application
		const existingApplication = await Application.findOne({
			job: jobId,
			applicantEmail: req.body.applicantEmail,
		});

		if (existingApplication) {
			return res.status(400).json({
				success: false,
				message: "You have already applied for this job",
			});
		}

		// Create application
		const application = await Application.create(req.body);

		// Increment application count
		job.applicationCount += 1;
		await job.save();

		// AUTO-ADD TO TRACKER if user is logged in
		if (req.user) {
			try {
				// Check if already tracking (edge case)
				const existingTracker = await Tracker.findOne({
					user: req.user.id,
					platformApplication: application._id,
				});

				if (!existingTracker) {
					// Create tracker entry automatically
					await Tracker.create({
						user: req.user.id,
						platformApplication: application._id,
						company: {
							name: job.company,
							location: job.location,
							website: job.companyWebsite,
						},
						job: {
							title: job.title,
							description: job.description,
							type: job.jobType,
							location: job.location,
							remote: job.remote || "On-site",
							salary: job.salary
								? {
										min: job.salary.min,
										max: job.salary.max,
										currency: job.salary.currency || "USD",
										period: job.salary.period || "yearly",
								  }
								: undefined,
						},
						status: "applied",
						dates: {
							applied: new Date(),
							deadline: job.applicationDeadline,
						},
						documents: {
							resume: {
								url: req.body.resumeUrl,
								uploadedAt: new Date(),
							},
							coverLetter: req.body.coverLetter
								? {
										url: req.body.coverLetter,
										uploadedAt: new Date(),
								  }
								: undefined,
							portfolio: req.body.portfolioUrl,
						},
						metadata: {
							source: "Platform",
						},
						notes: {
							general: `Applied through platform on ${new Date().toLocaleDateString()}`,
						},
					});
				}
			} catch (trackerError) {
				// Don't fail the application if tracker fails
				console.error("Failed to auto-create tracker:", trackerError);
			}
		}

		res.status(201).json({
			success: true,
			message: "Application submitted successfully",
			data: application,
			trackerAdded: !!req.user, // Indicates if it was added to tracker
		});
	} catch (error) {
		next(error);
	}
};
// @desc    Get all applications (Admin)
// @route   GET /api/applications
// @access  Private/Admin
exports.getApplications = async (req, res, next) => {
	try {
		const page = parseInt(req.query.page, 10) || 1;
		const limit = parseInt(req.query.limit, 10) || 10;
		const skip = (page - 1) * limit;

		let query = {};

		// Filter by job
		if (req.query.job) {
			query.job = req.query.job;
		}

		// Filter by status
		if (req.query.status) {
			query.status = req.query.status;
		}

		const applications = await Application.find(query)
			.populate({
				path: "job",
				select: "title company location jobType",
			})
			.sort("-appliedAt")
			.skip(skip)
			.limit(limit);

		const total = await Application.countDocuments(query);

		res.status(200).json({
			success: true,
			count: applications.length,
			total,
			page,
			pages: Math.ceil(total / limit),
			data: applications,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get applications for a specific job
// @route   GET /api/applications/job/:jobId
// @access  Private/Admin
exports.getJobApplications = async (req, res, next) => {
	try {
		const applications = await Application.find({job: req.params.jobId})
			.populate({
				path: "job",
				select: "title company location jobType",
			})
			.sort("-appliedAt");

		res.status(200).json({
			success: true,
			count: applications.length,
			data: applications,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get single application
// @route   GET /api/applications/:id
// @access  Private/Admin
exports.getApplication = async (req, res, next) => {
	try {
		const application = await Application.findById(req.params.id).populate({
			path: "job",
			select: "title company location jobType contactEmail",
		});

		if (!application) {
			return res.status(404).json({
				success: false,
				message: "Application not found",
			});
		}

		res.status(200).json({
			success: true,
			data: application,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Update application status
// @route   PUT /api/applications/:id
// @access  Private/Admin
exports.updateApplicationStatus = async (req, res, next) => {
	try {
		const {status} = req.body;

		const application = await Application.findById(req.params.id);

		if (!application) {
			return res.status(404).json({
				success: false,
				message: "Application not found",
			});
		}

		const oldStatus = application.status;
		application.status = status;
		await application.save();

		// SYNC WITH TRACKER - Update the tracker status too
		try {
			const tracker = await Tracker.findOne({
				platformApplication: application._id,
			});

			if (tracker) {
				// Map platform status to tracker status
				const statusMap = {
					pending: "applied",
					reviewing: "applied",
					shortlisted: "interview_scheduled",
					rejected: "rejected",
					accepted: "offer_received",
				};

				const newTrackerStatus = statusMap[status] || tracker.status;

				if (newTrackerStatus !== tracker.status) {
					tracker.status = newTrackerStatus;
					tracker.statusHistory.push({
						status: newTrackerStatus,
						date: new Date(),
						notes: `Status updated by employer: ${oldStatus} → ${status}`,
					});
					await tracker.save();

					// Optionally notify the student
					const Notification = require("../models/Notification");
					await Notification.create({
						user: tracker.user,
						type: "application_update",
						message: `Your application status for ${application.job.title} has been updated to ${status}`,
						link: `/tracker/${tracker._id}`,
						metadata: {
							applicationId: application._id.toString(),
							trackerId: tracker._id.toString(),
							newStatus: status,
						},
					});
				}
			}
		} catch (syncError) {
			console.error("Failed to sync with tracker:", syncError);
			// Don't fail the main operation
		}

		res.status(200).json({
			success: true,
			data: application,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Delete application
// @route   DELETE /api/applications/:id
// @access  Private/Admin
exports.deleteApplication = async (req, res, next) => {
	try {
		const application = await Application.findById(req.params.id);

		if (!application) {
			return res.status(404).json({
				success: false,
				message: "Application not found",
			});
		}

		// Decrement application count in job
		await Job.findByIdAndUpdate(application.job, {
			$inc: {applicationCount: -1},
		});

		await application.deleteOne();

		res.status(200).json({
			success: true,
			message: "Application deleted successfully",
			data: {},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get application statistics
// @route   GET /api/applications/stats/overview
// @access  Private/Admin
exports.getApplicationStats = async (req, res, next) => {
	try {
		const stats = await Application.aggregate([
			{
				$group: {
					_id: "$status",
					count: {$sum: 1},
				},
			},
		]);

		const totalApplications = await Application.countDocuments();
		const recentApplications = await Application.countDocuments({
			appliedAt: {$gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)},
		});

		res.status(200).json({
			success: true,
			data: {
				totalApplications,
				recentApplications,
				byStatus: stats,
			},
		});
	} catch (error) {
		next(error);
	}
};
