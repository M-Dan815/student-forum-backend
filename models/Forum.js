const mongoose = require("mongoose");

const forumSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
		},
		description: {
			type: String,
			required: true,
		},
		category: {
			type: String,
			required: true,
			enum: ["Careers", "Study Help", "Interests", "General", "Announcements"],
		},
		icon: String,
		moderators: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		threadCount: {
			type: Number,
			default: 0,
		},
		postCount: {
			type: Number,
			default: 0,
		},
		lastPost: {
			thread: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "Thread",
			},
			user: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
			date: Date,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		order: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("Forum", forumSchema);
