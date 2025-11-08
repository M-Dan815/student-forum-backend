const Application = require("../models/Application");
const Job = require("../models/Job");

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

		res.status(201).json({
			success: true,
			message: "Application submitted successfully",
			data: application,
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

		application.status = status;
		await application.save();

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
