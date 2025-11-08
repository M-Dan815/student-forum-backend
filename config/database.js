const mongoose = require("mongoose");
const config = require("./config");

const connectDB = async () => {
	try {
		const conn = await mongoose.connect(
			config.mongodb.uri,
			config.mongodb.options
		);

		console.log(`MongoDB Connected: ${conn.connection.host}`);

		// Create default admin user if not exists
		await createDefaultAdmin();

		return conn;
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}
};

const createDefaultAdmin = async () => {
	try {
		const User = require("../models/User");
		const adminExists = await User.findOne({role: "admin"});

		if (!adminExists) {
			await User.create({
				name: "Admin",
				email: config.admin.email,
				password: config.admin.password,
				role: "admin",
			});
			console.log("Default admin user created");
		}
	} catch (error) {
		console.error("Error creating default admin:", error.message);
	}
};

module.exports = connectDB;
