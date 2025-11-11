const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/config");

// Protect routes
exports.protect = async (req, res, next) => {
	let token;

	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		token = req.headers.authorization.split(" ")[1];
	} else if (req.cookies.token) {
		token = req.cookies.token;
	}

	if (!token) {
		return res.status(401).json({
			success: false,
			message: "Not authorized to access this route",
		});
	}

	try {
		// Verify token
		const decoded = jwt.verify(token, config.jwt.secret);

		req.user = await User.findById(decoded.id);

		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: "User not found",
			});
		}

		// Check if user is active
		if (!req.user.isUserActive()) {
			let message = "Account is not active";

			if (req.user.status === "banned") {
				message = `Account has been banned. Reason: ${req.user.banReason}`;
			} else if (req.user.status === "suspended") {
				message = `Account is suspended until ${req.user.suspendedUntil}. Reason: ${req.user.suspensionReason}`;
			} else if (!req.user.isActive) {
				message = "Account is deactivated";
			}

			return res.status(403).json({
				success: false,
				message,
			});
		}

		// Update last active
		req.user.lastActive = new Date();
		await req.user.save();

		next();
	} catch (error) {
		return res.status(401).json({
			success: false,
			message: "Not authorized to access this route",
		});
	}
};

// Grant access to specific roles
exports.authorize = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				success: false,
				message: `User role ${req.user.role} is not authorized to access this route`,
			});
		}
		next();
	};
};
