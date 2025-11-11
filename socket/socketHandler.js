const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/config");

const socketHandler = (io) => {
	// Socket authentication middleware
	io.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth.token;
			const decoded = jwt.verify(token, config.jwt.secret);
			const user = await User.findById(decoded.id).select("-password");

			if (!user) {
				return next(new Error("Authentication failed"));
			}

			if (!user.isUserActive()) {
				return next(new Error("Account is not active"));
			}

			socket.userId = user._id.toString();
			socket.user = user;
			next();
		} catch (error) {
			next(new Error("Authentication failed"));
		}
	});

	io.on("connection", (socket) => {
		console.log(`User ${socket.user.name} connected`);

		// Join user's personal room
		socket.join(socket.userId);

		// Update user status to online
		User.findByIdAndUpdate(socket.userId, {
			lastActive: new Date(),
		}).exec();

		// Rest of socket handlers remain the same...
	});
};

module.exports = socketHandler;
