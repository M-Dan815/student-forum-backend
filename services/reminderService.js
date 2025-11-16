const cron = require("node-cron");
const Application = require("../models/Application");
const emailService = require("./emailService");
const Notification = require("../models/Notification");

class ReminderService {
	start() {
		// Run every hour to check for upcoming reminders
		cron.schedule("0 * * * *", async () => {
			await this.checkReminders();
		});

		// Run daily at 9 AM for deadline reminders
		cron.schedule("0 9 * * *", async () => {
			await this.checkDeadlines();
		});

		console.log("Reminder service started");
	}

	async checkReminders() {
		try {
			const now = new Date();
			const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

			// Find reminders that need to be sent
			const applications = await Application.find({
				"reminders.date": {
					$gte: now,
					$lte: oneHourLater,
				},
				"reminders.completed": false,
				"reminders.notificationSent": false,
			}).populate("user", "name email notificationPreferences");

			for (const app of applications) {
				for (const reminder of app.reminders) {
					if (
						reminder.date >= now &&
						reminder.date <= oneHourLater &&
						!reminder.completed &&
						!reminder.notificationSent
					) {
						// Send notification
						await this.sendReminderNotification(app, reminder);

						// Mark as sent
						reminder.notificationSent = true;
						await app.save();
					}
				}
			}
		} catch (error) {
			console.error("Error checking reminders:", error);
		}
	}

	async checkDeadlines() {
		try {
			const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
			const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

			// Find applications with upcoming deadlines
			const applications = await Application.find({
				"dates.deadline": {
					$gte: tomorrow,
					$lte: threeDaysLater,
				},
				status: {$in: ["to_apply", "applied"]},
			}).populate("user", "name email notificationPreferences");

			for (const app of applications) {
				await this.sendDeadlineNotification(app);
			}
		} catch (error) {
			console.error("Error checking deadlines:", error);
		}
	}

	async sendReminderNotification(application, reminder) {
		const user = application.user;

		// In-app notification
		await Notification.create({
			user: user._id,
			type: "reminder",
			message: `Reminder: ${reminder.title} for ${application.job.title} at ${application.company.name}`,
			link: `/applications/${application._id}`,
			metadata: {
				applicationId: application._id.toString(),
				reminderId: reminder._id.toString(),
			},
		});

		// Email notification if enabled
		if (user.notificationPreferences?.email?.jobAlerts) {
			await emailService.sendReminderEmail(user, application, reminder);
		}
	}

	async sendDeadlineNotification(application) {
		const user = application.user;
		const daysUntilDeadline = Math.ceil(
			(new Date(application.dates.deadline) - new Date()) /
				(1000 * 60 * 60 * 24)
		);

		// In-app notification
		await Notification.create({
			user: user._id,
			type: "deadline",
			message: `Deadline in ${daysUntilDeadline} days: ${application.job.title} at ${application.company.name}`,
			link: `/applications/${application._id}`,
			metadata: {
				applicationId: application._id.toString(),
				daysUntilDeadline: daysUntilDeadline.toString(),
			},
		});

		// Email notification if enabled
		if (user.notificationPreferences?.email?.jobAlerts) {
			await emailService.sendDeadlineEmail(
				user,
				application,
				daysUntilDeadline
			);
		}
	}
}

module.exports = new ReminderService();
