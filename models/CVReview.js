const mongoose = require("mongoose");

const cvReviewSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		fileName: {
			type: String,
			required: true,
		},
		fileSize: {
			type: Number,
			required: true,
		},
		filePath: {
			type: String,
			required: true,
		},
		encryptedPath: {
			type: String,
			required: true,
		},
		fileHash: {
			type: String,
			required: true,
		},
		version: {
			type: Number,
			default: 1,
		},
		previousVersion: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "CVReview",
		},
		extractedText: {
			type: String,
			select: false, // Don't return by default for security
		},
		analysis: {
			overallScore: {
				type: Number,
				min: 0,
				max: 100,
			},
			atsScore: {
				type: Number,
				min: 0,
				max: 100,
			},
			strengths: [
				{
					category: String,
					point: String,
					impact: {
						type: String,
						enum: ["High", "Medium", "Low"],
					},
				},
			],
			weaknesses: [
				{
					category: String,
					issue: String,
					severity: {
						type: String,
						enum: ["Critical", "Major", "Minor"],
					},
					suggestion: String,
				},
			],
			formatting: {
				score: {
					type: Number,
					min: 0,
					max: 100,
				},
				issues: [String],
				recommendations: [String],
			},
			keywords: {
				found: [String],
				missing: [String],
				industryRelevant: [String],
				overused: [String],
				suggestions: [String],
			},
			sections: {
				present: [String],
				missing: [String],
				order: [String],
				recommendations: [String],
			},
			improvementRoadmap: [
				{
					priority: {
						type: String,
						enum: ["Immediate", "Short-term", "Long-term"],
					},
					action: String,
					expectedImpact: String,
					timeRequired: String,
				},
			],
			industrySpecific: {
				industry: String,
				relevanceScore: Number,
				recommendations: [String],
				competitorsKeywords: [String],
			},
			summary: {
				brief: String,
				topThreeStrengths: [String],
				topThreeImprovements: [String],
				estimatedImprovementTime: String,
			},
		},
		metadata: {
			processingTime: Number, // in milliseconds
			aiModel: {
				type: String,
				default: "gemini-pro",
			},
			apiTokensUsed: Number,
			language: String,
			targetRole: String,
			experienceLevel: String,
		},
		status: {
			type: String,
			enum: ["uploading", "processing", "completed", "failed", "archived"],
			default: "uploading",
		},
		error: {
			message: String,
			code: String,
			timestamp: Date,
		},
		feedback: {
			rating: {
				type: Number,
				min: 1,
				max: 5,
			},
			comment: String,
			helpful: Boolean,
		},
		isDeleted: {
			type: Boolean,
			default: false,
		},
		deletedAt: Date,
		expiresAt: {
			type: Date,
			default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
cvReviewSchema.index({user: 1, createdAt: -1});
cvReviewSchema.index({user: 1, status: 1});
cvReviewSchema.index({fileHash: 1});
cvReviewSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

// Virtual for formatted file size
cvReviewSchema.virtual("formattedFileSize").get(function () {
	const size = this.fileSize;
	if (size < 1024) return size + " B";
	if (size < 1024 * 1024) return (size / 1024).toFixed(2) + " KB";
	return (size / (1024 * 1024)).toFixed(2) + " MB";
});

// Method to get improvement percentage
cvReviewSchema.methods.getImprovementPercentage = function (previousReview) {
	if (!previousReview) return null;

	const currentScore = this.analysis.overallScore;
	const previousScore = previousReview.analysis.overallScore;

	if (previousScore === 0) return 100;
	return (((currentScore - previousScore) / previousScore) * 100).toFixed(1);
};

module.exports = mongoose.model("CVReview", cvReviewSchema);
