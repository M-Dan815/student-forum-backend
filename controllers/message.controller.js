const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const Notification = require("../models/Notification");
const {validationResult} = require("express-validator");

exports.sendMessage = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const {recipientId, content} = req.body;
		const senderId = req.user._id;

		// Check if recipient exists
		const recipient = await User.findById(recipientId);
		if (!recipient) {
			return res.status(404).json({
				success: false,
				message: "Recipient not found",
			});
		}

		// Check if user is blocked
		if (recipient.blockedUsers.includes(senderId)) {
			return res.status(403).json({
				success: false,
				message: "You cannot send messages to this user",
			});
		}

		// Find or create conversation
		let conversation = await Conversation.findOne({
			participants: {$all: [senderId, recipientId]},
		});

		if (!conversation) {
			conversation = new Conversation({
				participants: [senderId, recipientId],
				unreadCount: new Map([[recipientId.toString(), 0]]),
			});
			await conversation.save();
		}

		// Create message
		const message = new Message({
			sender: senderId,
			recipient: recipientId,
			content,
			conversation: conversation._id,
		});

		await message.save();

		// Update conversation
		conversation.lastMessage = message._id;
		conversation.lastActivity = new Date();

		const unreadCount =
			conversation.unreadCount.get(recipientId.toString()) || 0;
		conversation.unreadCount.set(recipientId.toString(), unreadCount + 1);

		await conversation.save();

		// Create notification
		await Notification.create({
			user: recipientId,
			type: "message",
			message: `New message from ${req.user.username}`,
			link: `/messages/${conversation._id}`,
			from: senderId,
		});

		// Emit socket event for real-time delivery
		const io = req.app.get("io");
		io.to(recipientId.toString()).emit("newMessage", {
			message,
			conversation: conversation._id,
		});

		await message.populate("sender", "username avatar");

		res.status(201).json({
			success: true,
			message: message,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error sending message",
			error: error.message,
		});
	}
};

exports.getConversations = async (req, res) => {
	try {
		const userId = req.user._id;

		const conversations = await Conversation.find({
			participants: userId,
		})
			.populate("participants", "username avatar lastActive")
			.populate({
				path: "lastMessage",
				populate: {
					path: "sender",
					select: "username",
				},
			})
			.sort("-lastActivity");

		const conversationsWithUnread = conversations.map((conv) => {
			const convObj = conv.toObject();
			convObj.unreadCount = conv.unreadCount.get(userId.toString()) || 0;
			return convObj;
		});

		res.json({
			success: true,
			conversations: conversationsWithUnread,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching conversations",
			error: error.message,
		});
	}
};

exports.getMessages = async (req, res) => {
	try {
		const {conversationId} = req.params;
		const {page = 1, limit = 50} = req.query;
		const userId = req.user._id;

		const conversation = await Conversation.findById(conversationId);

		if (!conversation || !conversation.participants.includes(userId)) {
			return res.status(404).json({
				success: false,
				message: "Conversation not found",
			});
		}

		const messages = await Message.find({
			conversation: conversationId,
			$or: [
				{"isDeleted.sender": false, sender: userId},
				{"isDeleted.recipient": false, recipient: userId},
			],
		})
			.populate("sender", "username avatar")
			.populate("recipient", "username avatar")
			.sort("-createdAt")
			.limit(limit * 1)
			.skip((page - 1) * limit);

		// Mark messages as read
		await Message.updateMany(
			{
				conversation: conversationId,
				recipient: userId,
				isRead: false,
			},
			{
				isRead: true,
				readAt: new Date(),
			}
		);

		// Reset unread count
		conversation.unreadCount.set(userId.toString(), 0);
		await conversation.save();

		const total = await Message.countDocuments({
			conversation: conversationId,
			$or: [
				{"isDeleted.sender": false, sender: userId},
				{"isDeleted.recipient": false, recipient: userId},
			],
		});

		res.json({
			success: true,
			messages: messages.reverse(),
			pagination: {
				total,
				pages: Math.ceil(total / limit),
				current: page,
				limit,
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching messages",
			error: error.message,
		});
	}
};

exports.markAsRead = async (req, res) => {
	try {
		const {messageId} = req.params;
		const userId = req.user._id;

		const message = await Message.findOneAndUpdate(
			{
				_id: messageId,
				recipient: userId,
				isRead: false,
			},
			{
				isRead: true,
				readAt: new Date(),
			},
			{new: true}
		);

		if (!message) {
			return res.status(404).json({
				success: false,
				message: "Message not found",
			});
		}

		res.json({
			success: true,
			message: "Message marked as read",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error marking message as read",
			error: error.message,
		});
	}
};

exports.deleteMessage = async (req, res) => {
	try {
		const {messageId} = req.params;
		const userId = req.user._id;

		const message = await Message.findById(messageId);

		if (!message) {
			return res.status(404).json({
				success: false,
				message: "Message not found",
			});
		}

		if (message.sender.toString() === userId.toString()) {
			message.isDeleted.sender = true;
		} else if (message.recipient.toString() === userId.toString()) {
			message.isDeleted.recipient = true;
		} else {
			return res.status(403).json({
				success: false,
				message: "Not authorized to delete this message",
			});
		}

		await message.save();

		res.json({
			success: true,
			message: "Message deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error deleting message",
			error: error.message,
		});
	}
};

exports.getUnreadCount = async (req, res) => {
	try {
		const userId = req.user._id;

		const conversations = await Conversation.find({
			participants: userId,
		});

		let totalUnread = 0;
		conversations.forEach((conv) => {
			totalUnread += conv.unreadCount.get(userId.toString()) || 0;
		});

		res.json({
			success: true,
			unreadCount: totalUnread,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching unread count",
			error: error.message,
		});
	}
};
