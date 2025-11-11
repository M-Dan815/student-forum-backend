const User = require("../models/User");
const config = require("../config/config");

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
	try {
		const {name, email, password} = req.body;

		// Create user
		const user = await User.create({
			name,
			email,
			password,
		});

		sendTokenResponse(user, 201, res);
	} catch (error) {
		next(error);
	}
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
	try {
		const {email, password} = req.body;

		// Check for user
		const user = await User.findOne({email}).select("+password");

		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Check if password matches
		const isMatch = await user.matchPassword(password);

		if (!isMatch) {
			return res.status(401).json({
				success: false,
				message: "Invalid password",
			});
		}

		if (!user.isActive) {
			return res.status(401).json({
				success: false,
				message: "Account is deactivated",
			});
		}

		sendTokenResponse(user, 200, res);
	} catch (error) {
		next(error);
	}
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
	try {
		const user = await User.findById(req.user.id);

		res.status(200).json({
			success: true,
			data: user,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
	try {
		const fieldsToUpdate = {
			name: req.body.name,
			email: req.body.email,
		};

		const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
			new: true,
			runValidators: true,
		});

		res.status(200).json({
			success: true,
			data: user,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
	try {
		const user = await User.findById(req.user.id).select("+password");

		// Check current password
		if (!(await user.matchPassword(req.body.currentPassword))) {
			return res.status(401).json({
				success: false,
				message: "Password is incorrect",
			});
		}

		user.password = req.body.newPassword;
		await user.save();

		sendTokenResponse(user, 200, res);
	} catch (error) {
		next(error);
	}
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
	// Create token
	const token = user.getSignedJwtToken();

	const options = {
		expires: new Date(
			Date.now() + config.jwt.cookieExpire * 24 * 60 * 60 * 1000
		),
		httpOnly: true,
	};

	if (config.env === "production") {
		options.secure = true;
	}

	res
		.status(statusCode)
		.cookie("token", token, options)
		.json({
			success: true,
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
			},
		});
};

exports.updateAvatar = async (req, res, next) => {
	try {
		const {avatar} = req.body;

		const user = await User.findByIdAndUpdate(
			req.user.id,
			{avatar},
			{new: true, runValidators: true}
		);

		res.status(200).json({
			success: true,
			data: user,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Update notification preferences
// @route   PUT /api/auth/notifications
// @access  Private
exports.updateNotificationPreferences = async (req, res, next) => {
	try {
		const {notificationPreferences} = req.body;

		const user = await User.findByIdAndUpdate(
			req.user.id,
			{notificationPreferences},
			{new: true, runValidators: true}
		);

		res.status(200).json({
			success: true,
			data: user.notificationPreferences,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get user's forum statistics
// @route   GET /api/auth/stats
// @access  Private
exports.getUserStats = async (req, res, next) => {
	try {
		const Thread = require("../models/Thread");
		const Message = require("../models/Message");

		const [totalThreads, totalPosts, totalMessages] = await Promise.all([
			Thread.countDocuments({author: req.user.id, isDeleted: false}),
			Thread.aggregate([
				{$match: {"replies.author": req.user.id}},
				{$unwind: "$replies"},
				{$match: {"replies.author": req.user.id}},
				{$count: "total"},
			]),
			Message.countDocuments({sender: req.user.id}),
		]);

		res.status(200).json({
			success: true,
			data: {
				totalThreads,
				totalPosts: totalPosts[0]?.total || 0,
				totalMessages,
				reputation: req.user.statistics.reputation,
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res, next) => {
	try {
		// Clear the cookie by setting it to expire in 10 seconds
		res.cookie("token", "none", {
			expires: new Date(Date.now() + 10 * 1000),
			httpOnly: true,
		});

		res.status(200).json({
			success: true,
			message: "Logged out successfully",
			data: {},
		});
	} catch (error) {
		next(error);
	}
};
