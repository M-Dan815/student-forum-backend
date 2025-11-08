const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const compression = require("compression");
const config = require("./config/config");
const errorHandler = require("./middleware/errorHandler");
const connectDB = require("./config/database");

// Route files
const authRoutes = require("./routes/auth");
const jobRoutes = require("./routes/jobs");
const applicationRoutes = require("./routes/applications");

const app = express();

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

connectDB();

const PORT = config.port;

const server = app.listen(PORT, () => {
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
