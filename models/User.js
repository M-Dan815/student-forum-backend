const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

const UserSchema = new mongoose.Schema({
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
		enum: ["admin", "moderator", "user"],
		default: "user",
	},
	isActive: {
		type: Boolean,
		default: true,
	},
	// Forum-specific fields
	avatar: {
		type: String,
		default: null,
	},
	status: {
		type: String,
		enum: ["active", "warned", "suspended", "banned"],
		default: "active",
	},
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
		},
		push: {
			messages: {type: Boolean, default: true},
			mentions: {type: Boolean, default: true},
			replies: {type: Boolean, default: true},
		},
	},
	lastActive: {
		type: Date,
		default: Date.now,
	},
	bio: {
		type: String,
		maxlength: 500,
	},
	location: String,
	website: String,
	socialLinks: {
		twitter: String,
		github: String,
		linkedin: String,
	},
	statistics: {
		totalPosts: {type: Number, default: 0},
		totalThreads: {type: Number, default: 0},
		reputation: {type: Number, default: 0},
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
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
	if (this.status === "banned") return false;
	if (this.status === "suspended" && this.suspendedUntil > new Date())
		return false;
	return true;
};

module.exports = mongoose.model("User", UserSchema);
