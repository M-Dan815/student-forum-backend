const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
	{
		sender: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		recipient: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		content: {
			type: String,
			required: true,
		},
		conversation: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Conversation",
			required: true,
		},
		isRead: {
			type: Boolean,
			default: false,
		},
		readAt: Date,
		isDeleted: {
			sender: {type: Boolean, default: false},
			recipient: {type: Boolean, default: false},
		},
		attachments: [
			{
				filename: String,
				url: String,
				type: String,
				size: Number,
			},
		],
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("Message", messageSchema);
