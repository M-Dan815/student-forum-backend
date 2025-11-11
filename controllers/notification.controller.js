const Notification = require("../models/Notification");
const {validationResult} = require("express-validator");

exports.getNotifications = async (req, res) => {
	try {
		const {page = 1, limit = 20, unreadOnly = false} = req.query;
		const userId = req.user._id;

		let query = {user: userId};
		if (unreadOnly === "true") {
			query.isRead = false;
		}

		const notifications = await Notification.find(query)
			.populate("from", "username avatar")
			.sort("-createdAt")
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await Notification.countDocuments(query);
		const unreadCount = await Notification.countDocuments({
			user: userId,
			isRead: false,
		});

		res.json({
			success: true,
			notifications,
			unreadCount,
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
			message: "Error fetching notifications",
			error: error.message,
		});
	}
};

exports.markAsRead = async (req, res) => {
	try {
		const {notificationId} = req.params;
		const userId = req.user._id;

		const notification = await Notification.findOneAndUpdate(
			{
				_id: notificationId,
				user: userId,
			},
			{
				isRead: true,
				readAt: new Date(),
			},
			{new: true}
		);

		if (!notification) {
			return res.status(404).json({
				success: false,
				message: "Notification not found",
			});
		}

		res.json({
			success: true,
			message: "Notification marked as read",
			notification,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error marking notification as read",
			error: error.message,
		});
	}
};

exports.markAllAsRead = async (req, res) => {
	try {
		const userId = req.user._id;

		await Notification.updateMany(
			{
				user: userId,
				isRead: false,
			},
			{
				isRead: true,
				readAt: new Date(),
			}
		);

		res.json({
			success: true,
			message: "All notifications marked as read",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error marking notifications as read",
			error: error.message,
		});
	}
};

exports.deleteNotification = async (req, res) => {
	try {
		const {notificationId} = req.params;
		const userId = req.user._id;

		const notification = await Notification.findOneAndDelete({
			_id: notificationId,
			user: userId,
		});

		if (!notification) {
			return res.status(404).json({
				success: false,
				message: "Notification not found",
			});
		}

		res.json({
			success: true,
			message: "Notification deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error deleting notification",
			error: error.message,
		});
	}
};

exports.deleteAllNotifications = async (req, res) => {
	try {
		const userId = req.user._id;

		await Notification.deleteMany({user: userId});

		res.json({
			success: true,
			message: "All notifications deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error deleting notifications",
			error: error.message,
		});
	}
};

exports.updateNotificationPreferences = async (req, res) => {
	try {
		const userId = req.user._id;
		const {preferences} = req.body;

		const user = await User.findByIdAndUpdate(
			userId,
			{
				notificationPreferences: preferences,
			},
			{new: true, runValidators: true}
		);

		res.json({
			success: true,
			message: "Notification preferences updated successfully",
			preferences: user.notificationPreferences,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error updating notification preferences",
			error: error.message,
		});
	}
};

exports.sendPushNotification = async (notification) => {
	// Implement push notification logic here
	// This could use services like Firebase Cloud Messaging, OneSignal, etc.
	try {
		// Example implementation
		console.log("Sending push notification:", notification);
		// Add your push notification service logic here
	} catch (error) {
		console.error("Error sending push notification:", error);
	}
};

exports.sendEmailNotification = async (notification, user) => {
	// Implement email notification logic here
	const nodemailer = require("nodemailer");

	try {
		const transporter = nodemailer.createTransport({
			host: process.env.EMAIL_HOST,
			port: process.env.EMAIL_PORT,
			secure: false,
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASS,
			},
		});

		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: user.email,
			subject: `New notification: ${notification.type}`,
			html: `
        <h3>You have a new notification</h3>
        <p>${notification.message}</p>
        <p>Click <a href="${process.env.CLIENT_URL}${notification.link}">here</a> to view</p>
      `,
		};

		await transporter.sendMail(mailOptions);
		console.log("Email notification sent successfully");
	} catch (error) {
		console.error("Error sending email notification:", error);
	}
};
