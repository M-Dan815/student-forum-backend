const nodemailer = require("nodemailer");
const config = require("../config/config");

class EmailService {
	constructor() {
		this.transporter = nodemailer.createTransport({
			host: config.email.host,
			port: config.email.port,
			secure: config.email.secure,
			auth: {
				user: config.email.user,
				pass: config.email.pass,
			},
		});
	}

	async sendEmail(options) {
		const mailOptions = {
			from: `${config.email.fromName} <${config.email.from}>`,
			to: options.to,
			subject: options.subject,
			html: options.html,
			text: options.text,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);
			console.log("Email sent:", info.messageId);
			return info;
		} catch (error) {
			console.error("Email send error:", error);
			throw error;
		}
	}

	async sendVerificationEmail(user, token) {
		const verifyUrl = `${config.client.url}/verify-email/${token}`;

		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
					.content { background-color: #f4f4f4; padding: 20px; margin-top: 20px; }
					.button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
					.footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>Welcome to Student Forum!</h1>
					</div>
					<div class="content">
						<h2>Hi ${user.name},</h2>
						<p>Thank you for registering! Please verify your email address to activate your account.</p>
						<p>Click the button below to verify your email:</p>
						<a href="${verifyUrl}" class="button">Verify Email</a>
						<p>Or copy and paste this link in your browser:</p>
						<p>${verifyUrl}</p>
						<p><strong>This link will expire in 24 hours.</strong></p>
						<p>If you didn't create an account, please ignore this email.</p>
					</div>
					<div class="footer">
						<p>&copy; 2024 Student Forum. All rights reserved.</p>
					</div>
				</div>
			</body>
			</html>
		`;

		await this.sendEmail({
			to: user.email,
			subject: "Verify Your Email - Student Forum",
			html,
			text: `Please verify your email by clicking: ${verifyUrl}`,
		});
	}

	async sendUniversityVerificationEmail(user, token) {
		const verifyUrl = `${config.client.url}/verify-university/${token}`;

		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
					.content { background-color: #f4f4f4; padding: 20px; margin-top: 20px; }
					.button { display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
					.footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>University Email Verification</h1>
					</div>
					<div class="content">
						<h2>Hi ${user.name},</h2>
						<p>Please verify your university email address to get the verified badge on your profile.</p>
						<p>University: <strong>${user.profile.university.name}</strong></p>
						<p>Email: <strong>${user.profile.university.email}</strong></p>
						<p>Click the button below to verify:</p>
						<a href="${verifyUrl}" class="button">Verify University Email</a>
						<p>Or copy and paste this link in your browser:</p>
						<p>${verifyUrl}</p>
						<p><strong>This link will expire in 24 hours.</strong></p>
					</div>
					<div class="footer">
						<p>&copy; 2024 Student Forum. All rights reserved.</p>
					</div>
				</div>
			</body>
			</html>
		`;

		await this.sendEmail({
			to: user.profile.university.email,
			subject: "Verify Your University Email - Student Forum",
			html,
			text: `Please verify your university email by clicking: ${verifyUrl}`,
		});
	}

	async sendPasswordResetEmail(user, token) {
		const resetUrl = `${config.client.url}/reset-password/${token}`;

		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
					.content { background-color: #f4f4f4; padding: 20px; margin-top: 20px; }
					.button { display: inline-block; padding: 10px 20px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
					.footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>Password Reset Request</h1>
					</div>
					<div class="content">
						<h2>Hi ${user.name},</h2>
						<p>You requested to reset your password. Click the button below to proceed:</p>
						<a href="${resetUrl}" class="button">Reset Password</a>
						<p>Or copy and paste this link in your browser:</p>
						<p>${resetUrl}</p>
						<p><strong>This link will expire in 10 minutes.</strong></p>
						<p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
					</div>
					<div class="footer">
						<p>&copy; 2024 Student Forum. All rights reserved.</p>
					</div>
				</div>
			</body>
			</html>
		`;

		await this.sendEmail({
			to: user.email,
			subject: "Password Reset Request - Student Forum",
			html,
			text: `Reset your password by clicking: ${resetUrl}`,
		});
	}

	async sendWelcomeEmail(user) {
		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
					.content { background-color: #f4f4f4; padding: 20px; margin-top: 20px; }
					.button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
					.tips { background-color: white; padding: 15px; margin-top: 20px; border-left: 4px solid #4CAF50; }
					.footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>Welcome to Student Forum!</h1>
					</div>
					<div class="content">
						<h2>Hi ${user.name},</h2>
						<p>Your account has been successfully activated! You're now part of our student community.</p>
						
						<div class="tips">
							<h3>Get Started:</h3>
							<ul>
								<li>Complete your profile to increase visibility</li>
								<li>Verify your university email for a verified badge</li>
								<li>Join forums and start discussions</li>
								<li>Connect with fellow students</li>
								<li>Explore career opportunities</li>
							</ul>
						</div>
						
						<a href="${config.client.url}/profile/edit" class="button">Complete Your Profile</a>
					</div>
					<div class="footer">
						<p>&copy; 2024 Student Forum. All rights reserved.</p>
					</div>
				</div>
			</body>
			</html>
		`;

		await this.sendEmail({
			to: user.email,
			subject: "Welcome to Student Forum!",
			html,
			text: "Welcome to Student Forum! Your account is now active.",
		});
	}
	async sendReminderEmail(user, application, reminder) {
		const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
				.container { max-width: 600px; margin: 0 auto; padding: 20px; }
				.header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
				.content { background-color: #f4f4f4; padding: 20px; margin-top: 20px; }
				.button { display: inline-block; padding: 10px 20px; background-color: #F59E0B; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
				.details { background-color: white; padding: 15px; margin-top: 15px; border-radius: 5px; }
				.footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
			</style>
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h1>📅 Application Reminder</h1>
				</div>
				<div class="content">
					<h2>Hi ${user.name},</h2>
					<p>This is a reminder for your job application:</p>
					
					<div class="details">
						<h3>${reminder.title}</h3>
						<p><strong>Company:</strong> ${application.company.name}</p>
						<p><strong>Position:</strong> ${application.job.title}</p>
						${
							reminder.description
								? `<p><strong>Details:</strong> ${reminder.description}</p>`
								: ""
						}
						<p><strong>Time:</strong> ${reminder.time || "Not specified"}</p>
					</div>
					
					<a href="${config.client.url}/applications/${
			application._id
		}" class="button">View Application</a>
				</div>
				<div class="footer">
					<p>&copy; 2024 Student Forum. All rights reserved.</p>
				</div>
			</div>
		</body>
		</html>
	`;

		await this.sendEmail({
			to: user.email,
			subject: `Reminder: ${reminder.title}`,
			html,
			text: `Reminder: ${reminder.title} for ${application.job.title} at ${application.company.name}`,
		});
	}

	async sendDeadlineEmail(user, application, daysUntilDeadline) {
		const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
				.container { max-width: 600px; margin: 0 auto; padding: 20px; }
				.header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
				.content { background-color: #f4f4f4; padding: 20px; margin-top: 20px; }
				.button { display: inline-block; padding: 10px 20px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
				.deadline-box { background-color: #FEE2E2; border: 2px solid #EF4444; padding: 15px; margin: 15px 0; border-radius: 5px; text-align: center; }
				.footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
			</style>
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h1>⏰ Application Deadline Approaching</h1>
				</div>
				<div class="content">
					<h2>Hi ${user.name},</h2>
					
					<div class="deadline-box">
						<h2>${daysUntilDeadline} ${
			daysUntilDeadline === 1 ? "Day" : "Days"
		} Until Deadline!</h2>
						<p><strong>${application.job.title}</strong></p>
						<p>at <strong>${application.company.name}</strong></p>
					</div>
					
					<p>Don't miss your opportunity! The application deadline is approaching.</p>
					
					<a href="${config.client.url}/applications/${
			application._id
		}" class="button">Complete Application</a>
					
					<p style="margin-top: 20px;"><small>Deadline: ${new Date(
						application.dates.deadline
					).toLocaleDateString()}</small></p>
				</div>
				<div class="footer">
					<p>&copy; 2024 Student Forum. All rights reserved.</p>
				</div>
			</div>
		</body>
		</html>
	`;

		await this.sendEmail({
			to: user.email,
			subject: `⏰ Deadline in ${daysUntilDeadline} days: ${application.job.title} at ${application.company.name}`,
			html,
			text: `Deadline approaching: ${application.job.title} at ${application.company.name} - ${daysUntilDeadline} days left`,
		});
	}
}

module.exports = new EmailService();
