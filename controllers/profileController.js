const User = require("../models/User");
const crypto = require("crypto");
const emailService = require("../services/emailService");
const cloudinary = require("../config/cloudinary");
const {validationResult} = require("express-validator");

// @desc    Register student with email verification
// @route   POST /api/profile/register
// @access  Public
exports.registerStudent = async (req, res, next) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const {name, email, password, universityName, yearOfStudy, major} =
			req.body;

		// Check if user exists
		const userExists = await User.findOne({email});
		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists with this email",
			});
		}

		// Create user
		const user = await User.create({
			name,
			email,
			password,
			role: "student",
			profile: {
				university: {
					name: universityName,
				},
				yearOfStudy,
				major,
			},
		});

		// Generate email verification token
		const verifyToken = user.getEmailVerificationToken();
		await user.save();

		// Send verification email
		try {
			await emailService.sendVerificationEmail(user, verifyToken);
		} catch (error) {
			console.error("Email send error:", error);
			// Don't fail registration if email fails
		}

		res.status(201).json({
			success: true,
			message:
				"Registration successful! Please check your email to verify your account.",
			data: {
				id: user._id,
				name: user.name,
				email: user.email,
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Verify email address
// @route   GET /api/profile/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res, next) => {
	try {
		const {token} = req.params;

		// Get hashed token
		const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

		const user = await User.findOne({
			emailVerificationToken: hashedToken,
			emailVerificationExpire: {$gt: Date.now()},
		});

		if (!user) {
			return res.status(400).json({
				success: false,
				message: "Invalid or expired verification token",
			});
		}

		// Verify email
		user.isEmailVerified = true;
		user.isActive = true;
		user.status = "active";
		user.emailVerificationToken = undefined;
		user.emailVerificationExpire = undefined;
		await user.save();

		// Send welcome email
		try {
			await emailService.sendWelcomeEmail(user);
		} catch (error) {
			console.error("Welcome email error:", error);
		}

		// Generate token for auto-login
		const authToken = user.getSignedJwtToken();

		res.json({
			success: true,
			message: "Email verified successfully! Your account is now active.",
			token: authToken,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				profileCompleted: user.profileCompleted,
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Send university verification email
// @route   POST /api/profile/verify-university
// @access  Private
exports.sendUniversityVerification = async (req, res, next) => {
	try {
		const {universityEmail} = req.body;
		const userId = req.user.id;

		// Validate university email domain
		const emailDomain = universityEmail.split("@")[1];
		const validDomains = [".edu", ".ac.", ".edu."]; // Add more educational domains
		const isValidDomain = validDomains.some((domain) =>
			emailDomain.includes(domain)
		);

		if (!isValidDomain) {
			return res.status(400).json({
				success: false,
				message: "Please use a valid university email address",
			});
		}

		const user = await User.findById(userId);

		// Update university email
		user.profile.university.email = universityEmail;

		// Generate verification token
		const verifyToken = user.getUniversityVerificationToken();
		await user.save();

		// Send verification email
		await emailService.sendUniversityVerificationEmail(user, verifyToken);

		res.json({
			success: true,
			message: "Verification email sent to your university address",
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Verify university email
// @route   GET /api/profile/verify-university/:token
// @access  Public
exports.verifyUniversityEmail = async (req, res, next) => {
	try {
		const {token} = req.params;

		const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

		const user = await User.findOne({
			universityEmailVerificationToken: hashedToken,
			universityEmailVerificationExpire: {$gt: Date.now()},
		});

		if (!user) {
			return res.status(400).json({
				success: false,
				message: "Invalid or expired verification token",
			});
		}

		// Verify university email
		user.profile.university.isVerified = true;
		user.profile.university.verifiedAt = Date.now();
		user.universityEmailVerificationToken = undefined;
		user.universityEmailVerificationExpire = undefined;
		await user.save();

		res.json({
			success: true,
			message: "University email verified successfully!",
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Upload profile photo
// @route   POST /api/profile/upload-photo
// @access  Private
exports.uploadProfilePhoto = async (req, res, next) => {
	try {
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "Please upload a file",
			});
		}

		const userId = req.user.id;
		const user = await User.findById(userId);

		// Delete old photo from cloudinary if exists
		if (user.profile.photo.public_id) {
			await cloudinary.uploader.destroy(user.profile.photo.public_id);
		}

		// File is already uploaded to Cloudinary by multer
		user.profile.photo = {
			url: req.file.path, // Cloudinary URL
			public_id: req.file.filename, // Cloudinary public ID
		};
		await user.save();

		res.json({
			success: true,
			message: "Profile photo uploaded successfully",
			photo: user.profile.photo.url,
		});
	} catch (error) {
		// Delete uploaded file from Cloudinary if database save fails
		if (req.file && req.file.filename) {
			try {
				await cloudinary.uploader.destroy(req.file.filename);
			} catch (deleteError) {
				console.error("Error deleting Cloudinary file:", deleteError);
			}
		}
		next(error);
	}
};

// @desc    Update profile
// @route   PUT /api/profile/update
// @access  Private
exports.updateProfile = async (req, res, next) => {
	try {
		const userId = req.user.id;
		const updates = req.body;

		// Fields that cannot be updated through this endpoint
		const restrictedFields = [
			"email",
			"password",
			"role",
			"isEmailVerified",
			"isActive",
		];
		restrictedFields.forEach((field) => delete updates[field]);

		const user = await User.findById(userId);

		// Update profile fields
		Object.keys(updates).forEach((key) => {
			if (key === "profile") {
				Object.assign(user.profile, updates.profile);
			} else {
				user[key] = updates[key];
			}
		});

		// Calculate completion percentage
		user.profile.completionPercentage = user.calculateProfileCompletion();

		await user.save();

		res.json({
			success: true,
			message: "Profile updated successfully",
			data: user,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get profile completion wizard data
// @route   GET /api/profile/wizard
// @access  Private
exports.getProfileWizard = async (req, res, next) => {
	try {
		const userId = req.user.id;
		const user = await User.findById(userId);

		const wizardSteps = [
			{
				step: 1,
				title: "Basic Information",
				fields: ["name", "email", "profile.bio"],
				completed: !!(user.name && user.email && user.profile.bio),
			},
			{
				step: 2,
				title: "University Details",
				fields: [
					"profile.university.name",
					"profile.yearOfStudy",
					"profile.major",
				],
				completed: !!(
					user.profile.university.name &&
					user.profile.yearOfStudy &&
					user.profile.major
				),
			},
			{
				step: 3,
				title: "Career Interests",
				fields: [
					"profile.careerInterests.industries",
					"profile.careerInterests.roles",
				],
				completed: !!(
					user.profile.careerInterests.industries?.length &&
					user.profile.careerInterests.roles?.length
				),
			},
			{
				step: 4,
				title: "Skills & Experience",
				fields: ["profile.skills.technical", "profile.skills.soft"],
				completed: !!(
					user.profile.skills.technical?.length ||
					user.profile.skills.soft?.length
				),
			},
			{
				step: 5,
				title: "Social Links & Photo",
				fields: ["profile.socialLinks.linkedin", "profile.photo.url"],
				completed: !!(
					user.profile.socialLinks.linkedin || user.profile.photo.url
				),
			},
		];

		const completedSteps = wizardSteps.filter((step) => step.completed).length;
		const totalSteps = wizardSteps.length;
		const overallCompletion = Math.round((completedSteps / totalSteps) * 100);

		res.json({
			success: true,
			data: {
				wizardSteps,
				completedSteps,
				totalSteps,
				overallCompletion,
				currentProfile: user,
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get public profile
// @route   GET /api/profile/user/:userId
// @access  Public
exports.getPublicProfile = async (req, res, next) => {
	try {
		const {userId} = req.params;
		const viewerId = req.user?.id;

		const user = await User.findById(userId).select(
			"-password -emailVerificationToken -passwordResetToken -warnings -blockedUsers"
		);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		// Check visibility settings
		if (
			user.profile.visibility === "private" &&
			(!viewerId || viewerId !== userId)
		) {
			return res.status(403).json({
				success: false,
				message: "This profile is private",
			});
		}

		// Track profile view
		if (viewerId && viewerId !== userId) {
			user.profileViews++;

			// Add to viewers list (keep last 100)
			user.profileViewers.push({
				viewer: viewerId,
				viewedAt: Date.now(),
			});

			if (user.profileViewers.length > 100) {
				user.profileViewers = user.profileViewers.slice(-100);
			}

			await user.save();
		}

		res.json({
			success: true,
			data: user,
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Search students
// @route   GET /api/profile/search
// @access  Public
exports.searchStudents = async (req, res, next) => {
	try {
		const {
			query,
			university,
			major,
			yearOfStudy,
			skills,
			page = 1,
			limit = 20,
		} = req.query;

		let searchQuery = {
			role: "student",
			isActive: true,
			"profile.visibility": {$ne: "private"},
		};

		// Text search
		if (query) {
			searchQuery.$text = {$search: query};
		}

		// Filters
		if (university) {
			searchQuery["profile.university.name"] = new RegExp(university, "i");
		}
		if (major) {
			searchQuery["profile.major"] = new RegExp(major, "i");
		}
		if (yearOfStudy) {
			searchQuery["profile.yearOfStudy"] = yearOfStudy;
		}
		if (skills) {
			const skillsArray = skills.split(",").map((s) => s.trim());
			searchQuery["profile.skills.technical.name"] = {$in: skillsArray};
		}

		const students = await User.find(searchQuery)
			.select(
				"name email profile.photo profile.university profile.major profile.yearOfStudy profile.bio profile.completionPercentage"
			)
			.sort("-profile.completionPercentage")
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await User.countDocuments(searchQuery);

		res.json({
			success: true,
			data: students,
			pagination: {
				total,
				pages: Math.ceil(total / limit),
				current: page,
				limit,
			},
		});
	} catch (error) {
		next(error);
	}
};

// @desc    Get profile statistics
// @route   GET /api/profile/stats
// @access  Private
exports.getProfileStats = async (req, res, next) => {
	try {
		const userId = req.user.id;
		const user = await User.findById(userId);

		const stats = {
			profileViews: user.profileViews,
			recentViewers: user.profileViewers.slice(-10).reverse(),
			completionPercentage: user.profile.completionPercentage,
			verificationStatus: {
				email: user.isEmailVerified,
				university: user.profile.university.isVerified,
			},
			activity: {
				posts: user.statistics.totalPosts,
				threads: user.statistics.totalThreads,
				reputation: user.statistics.reputation,
				connections: user.statistics.connectionsCount,
			},
		};

		res.json({
			success: true,
			data: stats,
		});
	} catch (error) {
		next(error);
	}
};
