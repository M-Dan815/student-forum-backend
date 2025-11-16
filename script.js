const mongoose = require("mongoose");
const User = require("./models/User");
const config = require("./config/config");

async function migrateUsers() {
	try {
		await mongoose.connect(config.mongodb.uri);

		// Update all existing users with new fields
		await User.updateMany(
			{},
			{
				$set: {
					status: "active",
					warnings: [],
					blockedUsers: [],
					notificationPreferences: {
						email: {
							messages: true,
							mentions: true,
							replies: true,
						},
						push: {
							messages: true,
							mentions: true,
							replies: true,
						},
					},
					statistics: {
						totalPosts: 0,
						totalThreads: 0,
						reputation: 0,
					},
				},
			}
		);

		console.log("User migration completed successfully");
		process.exit(0);
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	}
}

migrateUsers();
