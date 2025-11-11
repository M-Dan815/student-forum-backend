const User = require("../models/User");
const Thread = require("../models/Thread");
const Message = require("../models/Message");
const Report = require("../models/Report");
const Forum = require("../models/Forum");
const Notification = require("../models/Notification");

exports.getReports = async (req, res) => {
	try {
		const {status = "pending", page = 1, limit = 20} = req.query;

		const reports = await Report.find(status !== "all" ? {status} : {})
			.populate("reporter", "username email")
			.populate("reportedUser", "username email")
			.populate("resolvedBy", "username")
			.sort("-createdAt")
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await Report.countDocuments(status !== "all" ? {status} : {});

		res.json({
			success: true,
			reports,
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
			message: "Error fetching reports",
			error: error.message,
		});
	}
};

exports.getReport = async (req, res) => {
	try {
		const {reportId} = req.params;

		const report = await Report.findById(reportId)
			.populate("reporter", "username email")
			.populate("reportedUser", "username email status warnings")
			.populate("resolvedBy", "username");

		if (!report) {
			return res.status(404).json({
				success: false,
				message: "Report not found",
			});
		}

		// Get the reported content based on contentType
		let content = null;
		switch (report.contentType) {
			case "thread":
				content = await Thread.findById(report.contentId).populate(
					"author",
					"username"
				);
				break;
			case "message":
				content = await Message.findById(report.contentId)
					.populate("sender", "username")
					.populate("recipient", "username");
				break;
		}

		res.json({
			success: true,
			report,
			content,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching report",
			error: error.message,
		});
	}
};

exports.updateReport = async (req, res) => {
	try {
		const {reportId} = req.params;
		const {status, action, moderatorNotes} = req.body;

		const report = await Report.findById(reportId);

		if (!report) {
			return res.status(404).json({
				success: false,
				message: "Report not found",
			});
		}

		// Update report
		report.status = status;
		report.action = action;
		report.moderatorNotes = moderatorNotes;
		report.resolvedBy = req.user._id;
		report.resolvedAt = new Date();

		// Take action based on the decision
		if (action && action !== "none") {
			switch (action) {
				case "warning":
					await this.issueWarning(
						report.reportedUser,
						moderatorNotes,
						req.user._id
					);
					break;
				case "content_removed":
					await this.removeContent(
						report.contentType,
						report.contentId,
						req.user._id
					);
					break;
				case "user_suspended":
					await this.suspendUserById(
						report.reportedUser,
						7,
						moderatorNotes,
						req.user._id
					);
					break;
				case "user_banned":
					await this.banUserById(
						report.reportedUser,
						moderatorNotes,
						req.user._id
					);
					break;
			}
		}

		await report.save();

		// Notify the reporter about the resolution
		await Notification.create({
			user: report.reporter,
			type: "system",
			message: `Your report has been ${status}`,
			link: `/reports/${report._id}`,
		});

		res.json({
			success: true,
			message: "Report updated successfully",
			report,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error updating report",
			error: error.message,
		});
	}
};

exports.getUsers = async (req, res) => {
	try {
		const {
			status,
			role,
			search,
			page = 1,
			limit = 20,
			sort = "-joinedDate",
		} = req.query;

		let query = {};

		if (status) query.status = status;
		if (role) query.role = role;
		if (search) {
			query.$or = [
				{username: {$regex: search, $options: "i"}},
				{email: {$regex: search, $options: "i"}},
			];
		}

		const users = await User.find(query)
			.select("-password")
			.sort(sort)
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await User.countDocuments(query);

		res.json({
			success: true,
			users,
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
			message: "Error fetching users",
			error: error.message,
		});
	}
};

exports.warnUser = async (req, res) => {
	try {
		const {userId} = req.params;
		const {reason} = req.body;

		const user = await User.findById(userId);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		user.warnings.push({
			reason,
			issuedBy: req.user._id,
			date: new Date(),
		});

		if (user.warnings.length >= 3 && user.status === "active") {
			user.status = "warned";
		}

		await user.save();

		// Send notification to warned user
		await Notification.create({
			user: userId,
			type: "warning",
			message: `You have received a warning: ${reason}`,
			from: req.user._id,
		});

		res.json({
			success: true,
			message: "User warned successfully",
			user,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error warning user",
			error: error.message,
		});
	}
};

exports.suspendUser = async (req, res) => {
	try {
		const {userId} = req.params;
		const {duration, reason} = req.body; // duration in days

		const user = await User.findById(userId);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		user.status = "suspended";
		user.suspendedUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
		user.suspensionReason = reason;

		await user.save();

		// Send notification
		await Notification.create({
			user: userId,
			type: "suspension",
			message: `Your account has been suspended for ${duration} days. Reason: ${reason}`,
			from: req.user._id,
		});

		res.json({
			success: true,
			message: "User suspended successfully",
			user,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error suspending user",
			error: error.message,
		});
	}
};

exports.banUser = async (req, res) => {
	try {
		const {userId} = req.params;
		const {reason} = req.body;

		const user = await User.findById(userId);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		user.status = "banned";
		user.bannedAt = new Date();
		user.banReason = reason;

		await user.save();

		// Send notification
		await Notification.create({
			user: userId,
			type: "ban",
			message: `Your account has been permanently banned. Reason: ${reason}`,
			from: req.user._id,
		});

		res.json({
			success: true,
			message: "User banned successfully",
			user,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error banning user",
			error: error.message,
		});
	}
};

exports.unbanUser = async (req, res) => {
	try {
		const {userId} = req.params;

		const user = await User.findById(userId);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		user.status = "active";
		user.bannedAt = undefined;
		user.banReason = undefined;
		user.suspendedUntil = undefined;
		user.suspensionReason = undefined;

		await user.save();

		// Send notification
		await Notification.create({
			user: userId,
			type: "system",
			message: "Your account has been reinstated",
			from: req.user._id,
		});

		res.json({
			success: true,
			message: "User unbanned successfully",
			user,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error unbanning user",
			error: error.message,
		});
	}
};

exports.deleteThread = async (req, res) => {
	try {
		const {threadId} = req.params;
		const {reason} = req.body;

		const thread = await Thread.findById(threadId);

		if (!thread) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		thread.isDeleted = true;
		thread.deletedBy = req.user._id;
		thread.deletionReason = reason;
		await thread.save();

		// Update forum statistics
		await Forum.findByIdAndUpdate(thread.forum, {
			$inc: {threadCount: -1},
		});

		// Notify thread author
		await Notification.create({
			user: thread.author,
			type: "moderation",
			message: `Your thread "${thread.title}" has been removed. Reason: ${reason}`,
			from: req.user._id,
		});

		res.json({
			success: true,
			message: "Thread deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error deleting thread",
			error: error.message,
		});
	}
};

exports.deleteMessage = async (req, res) => {
	try {
		const {messageId} = req.params;
		const {reason} = req.body;

		const message = await Message.findById(messageId);

		if (!message) {
			return res.status(404).json({
				success: false,
				message: "Message not found",
			});
		}

		message.isDeleted = {
			sender: true,
			recipient: true,
		};
		message.deletedBy = req.user._id;
		message.deletionReason = reason;
		await message.save();

		// Notify sender
		await Notification.create({
			user: message.sender,
			type: "moderation",
			message: `Your message has been removed by a moderator. Reason: ${reason}`,
			from: req.user._id,
		});

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

exports.lockThread = async (req, res) => {
	try {
		const {threadId} = req.params;
		const {reason} = req.body;

		const thread = await Thread.findById(threadId);

		if (!thread) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		thread.isLocked = true;
		thread.lockedBy = req.user._id;
		thread.lockedAt = new Date();
		thread.lockReason = reason;
		await thread.save();

		// Notify thread author
		await Notification.create({
			user: thread.author,
			type: "moderation",
			message: `Your thread "${thread.title}" has been locked. Reason: ${reason}`,
			from: req.user._id,
		});

		res.json({
			success: true,
			message: "Thread locked successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error locking thread",
			error: error.message,
		});
	}
};

exports.pinThread = async (req, res) => {
	try {
		const {threadId} = req.params;

		const thread = await Thread.findById(threadId);

		if (!thread) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		thread.isPinned = !thread.isPinned;
		thread.pinnedBy = thread.isPinned ? req.user._id : undefined;
		thread.pinnedAt = thread.isPinned ? new Date() : undefined;
		await thread.save();

		res.json({
			success: true,
			message: thread.isPinned
				? "Thread pinned successfully"
				: "Thread unpinned successfully",
			thread,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error pinning/unpinning thread",
			error: error.message,
		});
	}
};

exports.getStatistics = async (req, res) => {
	try {
		const {startDate, endDate} = req.query;

		let dateFilter = {};
		if (startDate || endDate) {
			dateFilter.createdAt = {};
			if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
			if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
		}

		const [
			totalUsers,
			activeUsers,
			bannedUsers,
			totalThreads,
			totalMessages,
			totalReports,
			pendingReports,
			newUsersToday,
			threadsToday,
			messagestoday,
		] = await Promise.all([
			User.countDocuments(),
			User.countDocuments({status: "active"}),
			User.countDocuments({status: "banned"}),
			Thread.countDocuments({isDeleted: false}),
			Message.countDocuments(),
			Report.countDocuments(),
			Report.countDocuments({status: "pending"}),
			User.countDocuments({
				joinedDate: {
					$gte: new Date(new Date().setHours(0, 0, 0, 0)),
				},
			}),
			Thread.countDocuments({
				createdAt: {
					$gte: new Date(new Date().setHours(0, 0, 0, 0)),
				},
			}),
			Message.countDocuments({
				createdAt: {
					$gte: new Date(new Date().setHours(0, 0, 0, 0)),
				},
			}),
		]);

		// Get top forums by activity
		const topForums = await Forum.aggregate([
			{
				$lookup: {
					from: "threads",
					localField: "_id",
					foreignField: "forum",
					as: "threads",
				},
			},
			{
				$project: {
					name: 1,
					threadCount: {$size: "$threads"},
					postCount: 1,
				},
			},
			{$sort: {threadCount: -1}},
			{$limit: 5},
		]);

		// Get moderation activity
		const moderationActivity = await Report.aggregate([
			{
				$match: {
					resolvedAt: {
						$gte: new Date(new Date().setDate(new Date().getDate() - 30)),
					},
				},
			},
			{
				$group: {
					_id: "$action",
					count: {$sum: 1},
				},
			},
		]);

		res.json({
			success: true,
			statistics: {
				users: {
					total: totalUsers,
					active: activeUsers,
					banned: bannedUsers,
					newToday: newUsersToday,
				},
				content: {
					threads: totalThreads,
					messages: totalMessages,
					threadsToday,
					messagestoday,
				},
				reports: {
					total: totalReports,
					pending: pendingReports,
				},
				topForums,
				moderationActivity,
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching statistics",
			error: error.message,
		});
	}
};

// Helper functions
exports.issueWarning = async (userId, reason, issuedBy) => {
	const user = await User.findById(userId);
	if (user) {
		user.warnings.push({
			reason,
			issuedBy,
			date: new Date(),
		});
		if (user.warnings.length >= 3) {
			user.status = "warned";
		}
		await user.save();
	}
};

exports.removeContent = async (contentType, contentId, deletedBy) => {
	switch (contentType) {
		case "thread":
			await Thread.findByIdAndUpdate(contentId, {
				isDeleted: true,
				deletedBy,
			});
			break;
		case "message":
			await Message.findByIdAndUpdate(contentId, {
				isDeleted: {sender: true, recipient: true},
				deletedBy,
			});
			break;
	}
};

exports.suspendUserById = async (userId, days, reason, suspendedBy) => {
	await User.findByIdAndUpdate(userId, {
		status: "suspended",
		suspendedUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
		suspensionReason: reason,
	});
};

exports.banUserById = async (userId, reason, bannedBy) => {
	await User.findByIdAndUpdate(userId, {
		status: "banned",
		bannedAt: new Date(),
		banReason: reason,
	});
};
