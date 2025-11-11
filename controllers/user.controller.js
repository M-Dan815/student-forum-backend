const User = require("../models/User");
const Report = require("../models/Report");
const {validationResult} = require("express-validator");

exports.getProfile = async (req, res) => {
	try {
		const {userId} = req.params;

		const user = await User.findById(userId).select(
			"-password -warnings -blockedUsers"
		);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		res.json({
			success: true,
			user,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching user profile",
			error: error.message,
		});
	}
};

exports.updateProfile = async (req, res) => {
	try {
		const userId = req.user._id;
		const {username, email, avatar} = req.body;

		const updates = {};
		if (username) updates.username = username;
		if (email) updates.email = email;
		if (avatar) updates.avatar = avatar;

		const user = await User.findByIdAndUpdate(userId, updates, {
			new: true,
			runValidators: true,
		}).select("-password");

		res.json({
			success: true,
			message: "Profile updated successfully",
			user,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error updating profile",
			error: error.message,
		});
	}
};

exports.blockUser = async (req, res) => {
	try {
		const {userToBlockId} = req.params;
		const userId = req.user._id;

		if (userId.toString() === userToBlockId) {
			return res.status(400).json({
				success: false,
				message: "You cannot block yourself",
			});
		}

		const user = await User.findById(userId);

		if (!user.blockedUsers.includes(userToBlockId)) {
			user.blockedUsers.push(userToBlockId);
			await user.save();
		}

		res.json({
			success: true,
			message: "User blocked successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error blocking user",
			error: error.message,
		});
	}
};

exports.unblockUser = async (req, res) => {
	try {
		const {userToUnblockId} = req.params;
		const userId = req.user._id;

		const user = await User.findById(userId);

		user.blockedUsers = user.blockedUsers.filter(
			(id) => id.toString() !== userToUnblockId
		);
		await user.save();

		res.json({
			success: true,
			message: "User unblocked successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error unblocking user",
			error: error.message,
		});
	}
};

exports.getBlockedUsers = async (req, res) => {
	try {
		const userId = req.user._id;

		const user = await User.findById(userId).populate(
			"blockedUsers",
			"username avatar"
		);

		res.json({
			success: true,
			blockedUsers: user.blockedUsers,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching blocked users",
			error: error.message,
		});
	}
};

exports.reportUser = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const {userToReportId} = req.params;
		const {reason, description} = req.body;
		const reporterId = req.user._id;

		if (reporterId.toString() === userToReportId) {
			return res.status(400).json({
				success: false,
				message: "You cannot report yourself",
			});
		}

		// Check if user already reported this user recently
		const existingReport = await Report.findOne({
			reporter: reporterId,
			reportedUser: userToReportId,
			status: "pending",
			createdAt: {
				$gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
			},
		});

		if (existingReport) {
			return res.status(400).json({
				success: false,
				message: "You have already reported this user recently",
			});
		}

		const report = new Report({
			reporter: reporterId,
			reportedUser: userToReportId,
			contentType: "user",
			contentId: userToReportId,
			reason,
			description,
		});

		await report.save();

		res.status(201).json({
			success: true,
			message: "User reported successfully",
			report,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error reporting user",
			error: error.message,
		});
	}
};

exports.reportContent = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const {contentType, contentId, reason, description} = req.body;
		const reporterId = req.user._id;

		// Check if already reported
		const existingReport = await Report.findOne({
			reporter: reporterId,
			contentType,
			contentId,
			status: "pending",
		});

		if (existingReport) {
			return res.status(400).json({
				success: false,
				message: "You have already reported this content",
			});
		}

		// Get the content author
		let reportedUser;
		switch (contentType) {
			case "thread":
				const Thread = require("../models/Thread");
				const thread = await Thread.findById(contentId);
				if (!thread) {
					return res.status(404).json({
						success: false,
						message: "Content not found",
					});
				}
				reportedUser = thread.author;
				break;
			case "message":
				const Message = require("../models/Message");
				const message = await Message.findById(contentId);
				if (!message) {
					return res.status(404).json({
						success: false,
						message: "Content not found",
					});
				}
				reportedUser = message.sender;
				break;
		}

		const report = new Report({
			reporter: reporterId,
			reportedUser,
			contentType,
			contentId,
			reason,
			description,
		});

		await report.save();

		res.status(201).json({
			success: true,
			message: "Content reported successfully",
			report,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error reporting content",
			error: error.message,
		});
	}
};
