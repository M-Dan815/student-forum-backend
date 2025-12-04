const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config/config");

const UserSchema = new mongoose.Schema({
	// Basic Information
	name: {
		type: String,
		required: [true, "Please add a name"],
		trim: true,
		maxlength: [50, "Name cannot be more than 50 characters"],
	},
	email: {
		type: String,
		required: [true, "Please add an email"],
		unique: true,
		lowercase: true,
		match: [
			/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
			"Please add a valid email",
		],
	},
	password: {
		type: String,
		required: [true, "Please add a password"],
		minlength: 6,
		select: false,
	},
	role: {
		type: String,
		enum: ["admin", "moderator", "user", "student"],
		default: "student",
	},

	// Student Profile Information
	profile: {
		photo: {
			url: String,
			public_id: String, // For cloudinary or similar service
		},
		university: {
			name: {
				type: String,
				required: [
					function () {
						return this.role === "student";
					},
					"Please add university name",
				],
				default: function () {
					return this.role !== "student" ? "N/A" : undefined;
				},
			},
			email: {
				type: String,
				lowercase: true,
				match: [
					/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
					"Please add a valid university email",
				],
			},
			isVerified: {
				type: Boolean,
				default: false,
			},
			verifiedAt: Date,
		},
		yearOfStudy: {
			type: String,
			enum: [
				"Freshman",
				"Sophomore",
				"Junior",
				"Senior",
				"Graduate",
				"PhD",
				"Alumni",
				"N/A",
				"",
			],
			required: [
				function () {
					return this.role === "student";
				},
				"Please select year of study",
			],
			default: function () {
				return this.role !== "student" ? "N/A" : undefined;
			},
		},
		major: {
			type: String,
			required: [
				function () {
					return this.role === "student";
				},
				"Please add your major/course",
			],
			default: function () {
				return this.role !== "student" ? "N/A" : undefined;
			},
		},
		minor: String,
		expectedGraduation: {
			month: Number,
			year: Number,
		},
		gpa: {
			type: Number,
			min: 0,
			max: 4.0,
		},
		careerInterests: {
			industries: [String],
			roles: [String],
			aspirations: {
				type: String,
				maxlength: 500,
			},
			preferredLocations: [String],
			jobType: {
				type: [String],
				enum: ["Full-time", "Part-time", "Internship", "Co-op", "Remote"],
			},
		},
		personalInterests: {
			hobbies: [String],
			clubs: [String],
			activities: [String],
			achievements: [
				{
					title: String,
					description: String,
					date: Date,
				},
			],
		},
		skills: {
			technical: [
				{
					name: String,
					proficiency: {
						type: String,
						enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
					},
				},
			],
			soft: [String],
			languages: [
				{
					name: String,
					proficiency: {
						type: String,
						enum: ["Basic", "Conversational", "Fluent", "Native"],
					},
				},
			],
			certifications: [
				{
					name: String,
					issuer: String,
					date: Date,
					expiryDate: Date,
					credentialId: String,
					url: String,
				},
			],
		},
		experience: [
			{
				title: String,
				company: String,
				location: String,
				startDate: Date,
				endDate: Date,
				current: Boolean,
				description: String,
				type: {
					type: String,
					enum: [
						"Full-time",
						"Part-time",
						"Internship",
						"Volunteer",
						"Freelance",
					],
				},
			},
		],
		education: [
			{
				institution: String,
				degree: String,
				field: String,
				startDate: Date,
				endDate: Date,
				current: Boolean,
				description: String,
			},
		],
		socialLinks: {
			linkedin: {
				type: String,
				match: [
					/^https?:\/\/(www\.)?linkedin\.com\/.*$/,
					"Please enter a valid LinkedIn URL",
				],
			},
			github: {
				type: String,
				match: [
					/^https?:\/\/(www\.)?github\.com\/.*$/,
					"Please enter a valid GitHub URL",
				],
			},
			portfolio: {
				type: String,
				match: [/^https?:\/\/.*$/, "Please enter a valid URL"],
			},
			twitter: String,
			other: [String],
		},
		bio: {
			type: String,
			maxlength: [1000, "Bio cannot be more than 1000 characters"],
		},
		visibility: {
			type: String,
			enum: ["public", "private", "university", "connections"],
			default: "public",
		},
		completionPercentage: {
			type: Number,
			default: 0,
			min: 0,
			max: 100,
		},
	},

	// Verification & Security
	isEmailVerified: {
		type: Boolean,
		default: false,
	},
	emailVerificationToken: String,
	emailVerificationExpire: Date,
	universityEmailVerificationToken: String,
	universityEmailVerificationExpire: Date,
	passwordResetToken: String,
	passwordResetExpire: Date,
	twoFactorSecret: String,
	twoFactorEnabled: {
		type: Boolean,
		default: false,
	},

	// Account Status
	isActive: {
		type: Boolean,
		default: true,
	},
	status: {
		type: String,
		enum: ["active", "warned", "suspended", "banned", "pending"],
		default: function () {
			// Admins are active by default, students are pending until email verification
			return this.role === "admin" ? "active" : "pending";
		},
	},
	profileCompleted: {
		type: Boolean,
		default: false,
	},
	profileCompletedAt: Date,

	// Forum-related fields
	avatar: String,
	warnings: [
		{
			reason: String,
			issuedBy: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
			date: {
				type: Date,
				default: Date.now,
			},
		},
	],
	suspendedUntil: Date,
	suspensionReason: String,
	bannedAt: Date,
	banReason: String,
	blockedUsers: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	],
	notificationPreferences: {
		email: {
			messages: {type: Boolean, default: true},
			mentions: {type: Boolean, default: true},
			replies: {type: Boolean, default: true},
			jobAlerts: {type: Boolean, default: true},
			profileViews: {type: Boolean, default: true},
		},
		push: {
			messages: {type: Boolean, default: true},
			mentions: {type: Boolean, default: true},
			replies: {type: Boolean, default: true},
			jobAlerts: {type: Boolean, default: true},
			profileViews: {type: Boolean, default: true},
		},
	},

	// Activity & Statistics
	lastActive: {
		type: Date,
		default: Date.now,
	},
	profileViews: {
		type: Number,
		default: 0,
	},
	profileViewers: [
		{
			viewer: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
			viewedAt: {
				type: Date,
				default: Date.now,
			},
		},
	],
	statistics: {
		totalPosts: {type: Number, default: 0},
		totalThreads: {type: Number, default: 0},
		reputation: {type: Number, default: 0},
		connectionsCount: {type: Number, default: 0},
	},

	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: Date,
});

// Pre-validation hook to handle non-student users
UserSchema.pre("validate", function (next) {
	// Skip profile validation for non-students
	if (this.role === "admin" || this.role === "moderator") {
		// Initialize profile if it doesn't exist
		if (!this.profile) {
			this.profile = {};
		}

		// Set default values for required student fields
		if (!this.profile.university) {
			this.profile.university = {name: "N/A"};
		} else if (!this.profile.university.name) {
			this.profile.university.name = "N/A";
		}

		if (!this.profile.yearOfStudy) {
			this.profile.yearOfStudy = "N/A";
		}

		if (!this.profile.major) {
			this.profile.major = "N/A";
		}

		// Set profile completion to 100% for admins
		this.profile.completionPercentage = 100;
		this.profileCompleted = true;

		// Admins are automatically verified
		if (this.role === "admin") {
			this.isEmailVerified = true;
			this.status = "active";
		}
	}

	next();
});

// Calculate profile completion percentage (only for students)
UserSchema.methods.calculateProfileCompletion = function () {
	// Skip calculation for non-students
	if (this.role !== "student") {
		return 100;
	}

	const requiredFields = [
		"name",
		"email",
		"profile.university.name",
		"profile.yearOfStudy",
		"profile.major",
		"profile.bio",
	];

	const optionalFields = [
		"profile.photo.url",
		"profile.university.isVerified",
		"profile.careerInterests.industries",
		"profile.careerInterests.roles",
		"profile.personalInterests.hobbies",
		"profile.skills.technical",
		"profile.skills.soft",
		"profile.socialLinks.linkedin",
		"profile.experience",
		"profile.education",
	];

	let completed = 0;
	let total = requiredFields.length + optionalFields.length;

	// Check required fields
	requiredFields.forEach((field) => {
		const value = field.split(".").reduce((obj, key) => obj?.[key], this);
		if (value) completed++;
	});

	// Check optional fields
	optionalFields.forEach((field) => {
		const value = field.split(".").reduce((obj, key) => obj?.[key], this);
		if (value && (Array.isArray(value) ? value.length > 0 : true)) {
			completed++;
		}
	});

	return Math.round((completed / total) * 100);
};

// Generate email verification token
UserSchema.methods.getEmailVerificationToken = function () {
	const verificationToken = crypto.randomBytes(20).toString("hex");

	this.emailVerificationToken = crypto
		.createHash("sha256")
		.update(verificationToken)
		.digest("hex");

	this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

	return verificationToken;
};

// Generate university email verification token
UserSchema.methods.getUniversityVerificationToken = function () {
	const verificationToken = crypto.randomBytes(20).toString("hex");

	this.universityEmailVerificationToken = crypto
		.createHash("sha256")
		.update(verificationToken)
		.digest("hex");

	this.universityEmailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

	return verificationToken;
};

// Generate password reset token
UserSchema.methods.getResetPasswordToken = function () {
	const resetToken = crypto.randomBytes(20).toString("hex");

	this.passwordResetToken = crypto
		.createHash("sha256")
		.update(resetToken)
		.digest("hex");

	this.passwordResetExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

	return resetToken;
};

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
	return jwt.sign({id: this._id, role: this.role}, config.jwt.secret, {
		expiresIn: config.jwt.expire,
	});
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
	return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user is active (considering new status field)
UserSchema.methods.isUserActive = function () {
	if (!this.isActive) return false;

	// Admins don't need email verification
	if (this.role === "admin") return true;

	// Students need email verification
	if (!this.isEmailVerified && this.role === "student") return false;

	if (this.status === "banned") return false;
	if (this.status === "suspended" && this.suspendedUntil > new Date())
		return false;

	return true;
};

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
	// Update the updatedAt timestamp
	this.updatedAt = Date.now();

	// Update profile completion percentage for students
	if (this.isModified("profile") && this.role === "student") {
		this.profile.completionPercentage = this.calculateProfileCompletion();
		if (this.profile.completionPercentage === 100 && !this.profileCompleted) {
			this.profileCompleted = true;
			this.profileCompletedAt = Date.now();
		}
	}

	// Only hash password if it's modified
	if (!this.isModified("password")) {
		return next();
	}

	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
	next();
});

// Virtual for days until deadline
UserSchema.virtual("daysUntilDeadline").get(function () {
	if (!this.dates?.deadline) return null;
	const now = new Date();
	const deadline = new Date(this.dates.deadline);
	const diffTime = deadline - now;
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
});

// Virtual for application age
UserSchema.virtual("applicationAge").get(function () {
	if (!this.dates?.applied) return null;
	const now = new Date();
	const applied = new Date(this.dates.applied);
	const diffTime = now - applied;
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
});

// Index for search
UserSchema.index({
	name: "text",
	"profile.university.name": "text",
	"profile.major": "text",
	"profile.bio": "text",
});

// Additional indexes for performance
UserSchema.index({email: 1});
UserSchema.index({role: 1, status: 1});
UserSchema.index({"profile.university.name": 1, "profile.yearOfStudy": 1});

module.exports = mongoose.model("User", UserSchema);
