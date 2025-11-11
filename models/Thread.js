const mongoose = require("mongoose");

const threadSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			maxlength: 200,
		},
		content: {
			type: String,
			required: true,
		},
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		forum: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Forum",
			required: true,
		},
		tags: [String],
		isPinned: {
			type: Boolean,
			default: false,
		},
		isLocked: {
			type: Boolean,
			default: false,
		},
		views: {
			type: Number,
			default: 0,
		},
		replies: [
			{
				content: {
					type: String,
					required: true,
				},
				author: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
					required: true,
				},
				createdAt: {
					type: Date,
					default: Date.now,
				},
				updatedAt: Date,
				isDeleted: {
					type: Boolean,
					default: false,
				},
				deletedBy: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
				},
				upvotes: [
					{
						type: mongoose.Schema.Types.ObjectId,
						ref: "User",
					},
				],
				downvotes: [
					{
						type: mongoose.Schema.Types.ObjectId,
						ref: "User",
					},
				],
			},
		],
		upvotes: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		downvotes: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		isDeleted: {
			type: Boolean,
			default: false,
		},
		deletedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		lastActivity: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

threadSchema.index({title: "text", content: "text"});

module.exports = mongoose.model("Thread", threadSchema);
