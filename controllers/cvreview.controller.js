const CVReview = require("../models/CVReview");
const cvReviewService = require("../services/cvReviewService");
const User = require("../models/User");

// @desc    Upload and analyze CV
// @route   POST /api/cv-review/analyze
// @access  Private

exports.analyzeCV = async (req, res, next) => {
	try {
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "Please upload a CV file",
			});
		}

		// Check daily limit
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const todayReviews = await CVReview.countDocuments({
			user: req.user.id,
			createdAt: {$gte: today},
			status: "completed",
		});

		const dailyLimit = parseInt(process.env.CV_REVIEWS_PER_DAY_LIMIT || 10);
		if (todayReviews >= dailyLimit) {
			return res.status(429).json({
				success: false,
				message: `Daily limit of ${dailyLimit} CV reviews reached. Please try again tomorrow.`,
			});
		}

		const {targetRole, experienceLevel, forceReanalyze} = req.body; // 🆕 Add this

		// 🆕 If forceReanalyze is true, delete existing cached review
		if (forceReanalyze === "true" || forceReanalyze === true) {
			const fileHash = cvReviewService.generateFileHash(req.file.buffer);
			await CVReview.deleteMany({
				user: req.user.id,
				fileHash: fileHash,
			});
			console.log("🔄 Forcing re-analysis - deleted cached review");
		}

		const review = await cvReviewService.processCV(
			req.file,
			req.user.id,
			targetRole,
			experienceLevel
		);

		res.status(201).json({
			success: true,
			message: "CV analysis completed successfully",
			data: review,
		});
	} catch (error) {
		console.error("CV analysis error:", error);
		res.status(500).json({
			success: false,
			message: error.message || "Failed to analyze CV",
			error: process.env.NODE_ENV === "development" ? error.stack : undefined,
		});
	}
};

// @desc    Get all CV reviews for user
// @route   GET /api/cv-review/history
// @access  Private
exports.getReviewHistory = async (req, res, next) => {
	try {
		const {page = 1, limit = 10, status} = req.query;

		const query = {
			user: req.user.id,
			isDeleted: false,
		};

		if (status) {
			query.status = status;
		}

		const reviews = await CVReview.find(query)
			.select("-extractedText -encryptedPath")
			.sort("-createdAt")
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await CVReview.countDocuments(query);

		res.json({
			success: true,
			data: reviews,
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

// @desc    Get single CV review
// @route   GET /api/cv-review/:id
// @access  Private
exports.getReview = async (req, res, next) => {
	try {
		const review = await CVReview.findOne({
			_id: req.params.id,
			user: req.user.id,
			isDeleted: false,
		}).select("-extractedText -encryptedPath");

		if (!review) {
			return res.status(404).json({
				success: false,
				message: "Review not found",
			});
		}

		// Get previous version if exists
		let previousVersion = null;
		if (review.previousVersion) {
			previousVersion = await CVReview.findById(review.previousVersion).select(
				"analysis.overallScore analysis.atsScore createdAt version"
			);
		}

		res.json({
			success: true,
			data: {
				review,
				previousVersion,
				improvement: previousVersion
					? review.getImprovementPercentage(previousVersion)
					: null,
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Compare two CV versions
// @route   GET /api/cv-review/compare
// @access  Private
exports.compareVersions = async (req, res, next) => {
	try {
		const {currentId, previousId} = req.query;

		if (!currentId || !previousId) {
			return res.status(400).json({
				success: false,
				message: "Please provide both current and previous review IDs",
			});
		}

		const comparison = await cvReviewService.compareVersions(
			req.user.id,
			currentId,
			previousId
		);

		res.json({
			success: true,
			data: comparison,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Download feedback as PDF
// @route   GET /api/cv-review/:id/download
// @access  Private
exports.downloadFeedback = async (req, res, next) => {
	try {
		const report = await cvReviewService.generatePDFReport(
			req.params.id,
			req.user.id
		);

		// For now, return JSON that can be converted to PDF on frontend
		// In production, you'd generate actual PDF here
		res.json({
			success: true,
			data: report,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Delete CV review (soft delete)
// @route   DELETE /api/cv-review/:id
// @access  Private
exports.deleteReview = async (req, res, next) => {
	try {
		const review = await CVReview.findOne({
			_id: req.params.id,
			user: req.user.id,
			isDeleted: false,
		});

		if (!review) {
			return res.status(404).json({
				success: false,
				message: "Review not found",
			});
		}

		review.isDeleted = true;
		review.deletedAt = new Date();
		await review.save();

		res.json({
			success: true,
			message: "Review deleted successfully",
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Provide feedback on review
// @route   POST /api/cv-review/:id/feedback
// @access  Private
exports.provideFeedback = async (req, res, next) => {
	try {
		const {rating, comment, helpful} = req.body;

		const review = await CVReview.findOne({
			_id: req.params.id,
			user: req.user.id,
		});

		if (!review) {
			return res.status(404).json({
				success: false,
				message: "Review not found",
			});
		}

		review.feedback = {
			rating,
			comment,
			helpful,
		};
		await review.save();

		res.json({
			success: true,
			message: "Feedback submitted successfully",
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get review statistics
// @route   GET /api/cv-review/stats
// @access  Private
exports.getStats = async (req, res, next) => {
	try {
		const userId = req.user.id;

		const [
			totalReviews,
			completedReviews,
			averageScore,
			latestReview,
			improvementTrend,
		] = await Promise.all([
			CVReview.countDocuments({user: userId, isDeleted: false}),
			CVReview.countDocuments({
				user: userId,
				status: "completed",
				isDeleted: false,
			}),
			CVReview.aggregate([
				{$match: {user: mongoose.Types.ObjectId(userId), status: "completed"}},
				{$group: {_id: null, avgScore: {$avg: "$analysis.overallScore"}}},
			]),
			CVReview.findOne({user: userId, status: "completed"})
				.sort("-createdAt")
				.select("analysis.overallScore createdAt"),
			CVReview.find({user: userId, status: "completed"})
				.sort("createdAt")
				.select("analysis.overallScore createdAt")
				.limit(5),
		]);

		res.json({
			success: true,
			data: {
				totalReviews,
				completedReviews,
				averageScore: averageScore[0]?.avgScore || 0,
				latestScore: latestReview?.analysis?.overallScore || 0,
				improvementTrend: improvementTrend.map((r) => ({
					score: r.analysis.overallScore,
					date: r.createdAt,
				})),
			},
		});
	} catch (error) {
		next(error);
	}
};
