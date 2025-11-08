const Job = require("../models/Job");
const APIFeatures = require("../utils/helpers");

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res, next) => {
	try {
		// Build query
		let query = Job.find({isActive: true});

		// Apply filters
		const features = new APIFeatures(query, req.query)
			.filter()
			.search()
			.sort()
			.limitFields()
			.paginate();

		// Execute query
		const jobs = await features.query.populate("postedBy", "name email");

		// Get total count for pagination
		const total = await Job.countDocuments({isActive: true});

		res.status(200).json({
			success: true,
			count: jobs.length,
			total,
			page: parseInt(req.query.page, 10) || 1,
			pages: Math.ceil(total / (parseInt(req.query.limit, 10) || 10)),
			data: jobs,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get all jobs (Admin - includes inactive)
// @route   GET /api/jobs/admin
// @access  Private/Admin
exports.getAllJobsAdmin = async (req, res, next) => {
	try {
		const features = new APIFeatures(Job.find(), req.query)
			.filter()
			.search()
			.sort()
			.limitFields()
			.paginate();

		const jobs = await features.query.populate("postedBy", "name email");
		const total = await Job.countDocuments();

		res.status(200).json({
			success: true,
			count: jobs.length,
			total,
			page: parseInt(req.query.page, 10) || 1,
			pages: Math.ceil(total / (parseInt(req.query.limit, 10) || 10)),
			data: jobs,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
exports.getJob = async (req, res, next) => {
	try {
		const job = await Job.findById(req.params.id).populate(
			"postedBy",
			"name email"
		);

		if (!job) {
			return res.status(404).json({
				success: false,
				message: "Job not found",
			});
		}

		// Increment view count
		job.views += 1;
		await job.save();

		res.status(200).json({
			success: true,
			data: job,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private/Admin
exports.createJob = async (req, res, next) => {
	try {
		// Add user to req.body
		req.body.postedBy = req.user.id;

		const job = await Job.create(req.body);

		res.status(201).json({
			success: true,
			data: job,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private/Admin
exports.updateJob = async (req, res, next) => {
	try {
		let job = await Job.findById(req.params.id);

		if (!job) {
			return res.status(404).json({
				success: false,
				message: "Job not found",
			});
		}

		job = await Job.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});

		res.status(200).json({
			success: true,
			data: job,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private/Admin
exports.deleteJob = async (req, res, next) => {
	try {
		const job = await Job.findById(req.params.id);

		if (!job) {
			return res.status(404).json({
				success: false,
				message: "Job not found",
			});
		}

		await job.deleteOne();

		res.status(200).json({
			success: true,
			message: "Job deleted successfully",
			data: {},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Toggle job active status
// @route   PUT /api/jobs/:id/toggle-status
// @access  Private/Admin
exports.toggleJobStatus = async (req, res, next) => {
	try {
		const job = await Job.findById(req.params.id);

		if (!job) {
			return res.status(404).json({
				success: false,
				message: "Job not found",
			});
		}

		job.isActive = !job.isActive;
		await job.save();

		res.status(200).json({
			success: true,
			data: job,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get job statistics
// @route   GET /api/jobs/stats/overview
// @access  Private/Admin
exports.getJobStats = async (req, res, next) => {
	try {
		const stats = await Job.aggregate([
			{
				$group: {
					_id: "$jobType",
					count: {$sum: 1},
					avgApplications: {$avg: "$applicationCount"},
					totalViews: {$sum: "$views"},
				},
			},
		]);

		const totalJobs = await Job.countDocuments();
		const activeJobs = await Job.countDocuments({isActive: true});
		const expiredJobs = await Job.countDocuments({
			applicationDeadline: {$lt: new Date()},
		});

		res.status(200).json({
			success: true,
			data: {
				totalJobs,
				activeJobs,
				expiredJobs,
				byType: stats,
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Search jobs
// @route   GET /api/jobs/search
// @access  Public
exports.searchJobs = async (req, res, next) => {
	try {
		const {search, company, location, jobType, category, minSalary, maxSalary} =
			req.query;

		let query = {isActive: true};

		// Text search
		if (search) {
			query.$text = {$search: search};
		}

		// Filter by company
		if (company) {
			query.company = {$regex: company, $options: "i"};
		}

		// Filter by location
		if (location) {
			query.location = {$regex: location, $options: "i"};
		}

		// Filter by job type
		if (jobType) {
			query.jobType = jobType;
		}

		// Filter by category
		if (category) {
			query.category = category;
		}

		// Filter by salary
		if (minSalary || maxSalary) {
			query["salary.min"] = {};
			if (minSalary) query["salary.min"].$gte = Number(minSalary);
			if (maxSalary) query["salary.max"].$lte = Number(maxSalary);
		}

		const page = parseInt(req.query.page, 10) || 1;
		const limit = parseInt(req.query.limit, 10) || 10;
		const skip = (page - 1) * limit;

		const jobs = await Job.find(query)
			.populate("postedBy", "name email")
			.sort("-createdAt")
			.skip(skip)
			.limit(limit);

		const total = await Job.countDocuments(query);

		res.status(200).json({
			success: true,
			count: jobs.length,
			total,
			page,
			pages: Math.ceil(total / limit),
			data: jobs,
		});
	} catch (error) {
		next(error);
	}
};
