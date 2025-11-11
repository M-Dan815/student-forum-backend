const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const compression = require("compression");
const {createServer} = require("http"); // Add this
const {Server} = require("socket.io");
const config = require("./config/config");
const errorHandler = require("./middleware/errorHandler");
const connectDB = require("./config/database");
const socketHandler = require("./socket/socketHandler");

// Route files
const authRoutes = require("./routes/auth");
const jobRoutes = require("./routes/jobs");
const applicationRoutes = require("./routes/applications");

const app = express();

// Create HTTP server from Express app
const httpServer = createServer(app);

// Initialize Socket.io with the HTTP server
const io = new Server(httpServer, {
	cors: {
		origin: config.cors.origin || "http://localhost:3000",
		credentials: true,
	},
});

// IMPORTANT: Attach io to app so controllers can access it
app.set("io", io);

// Body parser
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Enable CORS
app.use(cors(config.cors));

// Set security headers
app.use(helmet());

// Sanitize data
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 100,
	message: "Too many requests from this IP, please try again later",
});
app.use("/api/", limiter);

// Dev logging middleware
if (config.env === "development") {
	app.use(morgan("dev"));
}

// Compression middleware
app.use(compression());

// Mount routers
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/forums", require("./routes/forum.routes"));
app.use("/api/threads", require("./routes/thread.routes"));
app.use("/api/messages", require("./routes/message.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/users", require("./routes/user.routes"));

// Socket.io handler - Initialize socket handlers
socketHandler(io);

// Health check
app.get("/health", (req, res) => {
	res.status(200).json({
		success: true,
		message: "Server is running",
		environment: config.env,
		timestamp: new Date().toISOString(),
	});
});

// 404 handler
app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: "Route not found",
	});
});

// Error handler
app.use(errorHandler);

// Connect to database
connectDB();

const PORT = config.port || 5000;

// Use httpServer.listen instead of app.listen
const server = httpServer.listen(PORT, () => {
	console.log(`Server running in ${config.env} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
	console.log(`Error: ${err.message}`);
	// Close server & exit process
	server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
	console.log(`Error: ${err.message}`);
	process.exit(1);
});

module.exports = app; // Export app if needed for testing
