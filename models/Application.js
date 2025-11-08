const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema({
	job: {
		type: mongoose.Schema.ObjectId,
		ref: "Job",
		required: true,
	},
	applicantName: {
		type: String,
		required: [true, "Please provide your name"],
		trim: true,
		maxlength: [100, "Name cannot be more than 100 characters"],
	},
	applicantEmail: {
		type: String,
		required: [true, "Please provide your email"],
		lowercase: true,
		match: [
			/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
			"Please provide a valid email",
		],
	},
	applicantPhone: {
		type: String,
		required: [true, "Please provide your phone number"],
	},
	resumeUrl: {
		type: String,
		required: [true, "Please provide resume URL"],
	},
	coverLetter: {
		type: String,
		maxlength: [2000, "Cover letter cannot be more than 2000 characters"],
	},
	linkedinProfile: {
		type: String,
		trim: true,
	},
	portfolioUrl: {
		type: String,
		trim: true,
	},
	status: {
		type: String,
		enum: ["pending", "reviewing", "shortlisted", "rejected", "accepted"],
		default: "pending",
	},
	appliedAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Prevent duplicate applications
ApplicationSchema.index({job: 1, applicantEmail: 1}, {unique: true});

// Update the updatedAt field before saving
ApplicationSchema.pre("save", function (next) {
	this.updatedAt = Date.now();
	next();
});

module.exports = mongoose.model("Application", ApplicationSchema);
