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
				required: [true, "Please add university name"],
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
			],
			required: [true, "Please select year of study"],
		},
		major: {
			type: String,
			required: [true, "Please add your major/course"],
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
		default: false, // Will be true after email verification
	},
	status: {
		type: String,
		enum: ["active", "warned", "suspended", "banned", "pending"],
		default: "pending",
	},
	profileCompleted: {
		type: Boolean,
		default: false,
	},
	profileCompletedAt: Date,

	// Forum-related fields (from previous module)
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

// Calculate profile completion percentage
UserSchema.methods.calculateProfileCompletion = function () {
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

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
	// Update the updatedAt timestamp
	this.updatedAt = Date.now();

	// Update profile completion percentage
	if (this.isModified("profile")) {
		this.profile.completionPercentage = this.calculateProfileCompletion();
		if (this.profile.completionPercentage === 100 && !this.profileCompleted) {
			this.profileCompleted = true;
			this.profileCompletedAt = Date.now();
		}
	}

	if (!this.isModified("password")) {
		next();
	}

	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
});

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
	if (!this.isEmailVerified) return false;
	if (this.status === "banned") return false;
	if (this.status === "suspended" && this.suspendedUntil > new Date())
		return false;
	return true;
};

// Index for search
UserSchema.index({
	name: "text",
	"profile.university.name": "text",
	"profile.major": "text",
	"profile.bio": "text",
});

module.exports = mongoose.model("User", UserSchema);
