const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
	{
		reporter: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		reportedUser: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		contentType: {
			type: String,
			enum: ["thread", "reply", "message", "user"],
			required: true,
		},
		contentId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		reason: {
			type: String,
			enum: ["spam", "harassment", "inappropriate", "misinformation", "other"],
			required: true,
		},
		description: String,
		status: {
			type: String,
			enum: ["pending", "reviewing", "resolved", "dismissed"],
			default: "pending",
		},
		moderatorNotes: String,
		resolvedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		resolvedAt: Date,
		action: {
			type: String,
			enum: [
				"none",
				"warning",
				"content_removed",
				"user_suspended",
				"user_banned",
			],
		},
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("Report", reportSchema);
