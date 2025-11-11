const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		type: {
			type: String,
			enum: [
				"message",
				"reply",
				"mention",
				"warning",
				"suspension",
				"ban",
				"moderation",
				"system",
			],
			required: true,
		},
		message: {
			type: String,
			required: true,
		},
		link: String,
		from: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		isRead: {
			type: Boolean,
			default: false,
		},
		readAt: Date,
		metadata: {
			type: Map,
			of: String,
		},
	},
	{
		timestamps: true,
	}
);

notificationSchema.index({user: 1, isRead: 1});
notificationSchema.index({createdAt: -1});

// Auto-delete old notifications after 30 days
notificationSchema.index({createdAt: 1}, {expireAfterSeconds: 2592000});

module.exports = mongoose.model("Notification", notificationSchema);
