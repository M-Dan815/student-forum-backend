const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema({
	title: {
		type: String,
		required: [true, "Please add a job title"],
		trim: true,
		maxlength: [100, "Title cannot be more than 100 characters"],
	},
	company: {
		type: String,
		required: [true, "Please add a company name"],
		trim: true,
		maxlength: [100, "Company name cannot be more than 100 characters"],
	},
	description: {
		type: String,
		required: [true, "Please add a job description"],
		maxlength: [5000, "Description cannot be more than 5000 characters"],
	},
	requirements: {
		type: [String],
		required: [true, "Please add job requirements"],
	},
	responsibilities: {
		type: [String],
		required: [true, "Please add job responsibilities"],
	},
	location: {
		type: String,
		required: [true, "Please add a location"],
		trim: true,
	},
	jobType: {
		type: String,
		required: [true, "Please specify job type"],
		enum: {
			values: ["Internship", "Full-time", "Part-time", "Remote", "Contract"],
			message: "{VALUE} is not a valid job type",
		},
	},
	category: {
		type: String,
		required: [true, "Please add a category"],
		enum: {
			values: [
				"Technology",
				"Marketing",
				"Sales",
				"Design",
				"Finance",
				"Human Resources",
				"Operations",
				"Customer Service",
				"Other",
			],
			message: "{VALUE} is not a valid category",
		},
	},
	salary: {
		min: {
			type: Number,
			default: 0,
		},
		max: {
			type: Number,
			default: 0,
		},
		currency: {
			type: String,
			default: "USD",
		},
		period: {
			type: String,
			enum: ["hourly", "monthly", "yearly"],
			default: "yearly",
		},
	},
	experience: {
		min: {
			type: Number,
			default: 0,
		},
		max: {
			type: Number,
			default: 0,
		},
	},
	skills: {
		type: [String],
		default: [],
	},
	benefits: {
		type: [String],
		default: [],
	},
	applicationDeadline: {
		type: Date,
		required: [true, "Please add application deadline"],
	},
	contactEmail: {
		type: String,
		required: [true, "Please add contact email"],
		match: [
			/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
			"Please add a valid email",
		],
	},
	companyWebsite: {
		type: String,
		trim: true,
	},
	companyLogo: {
		type: String,
		default: "",
	},
	isActive: {
		type: Boolean,
		default: true,
	},
	featured: {
		type: Boolean,
		default: false,
	},
	views: {
		type: Number,
		default: 0,
	},
	applicationCount: {
		type: Number,
		default: 0,
	},
	postedBy: {
		type: mongoose.Schema.ObjectId,
		ref: "User",
		required: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Update the updatedAt field before saving
JobSchema.pre("save", function (next) {
	this.updatedAt = Date.now();
	next();
});

// Create index for search
JobSchema.index({
	title: "text",
	company: "text",
	description: "text",
	location: "text",
});

// Check if job deadline has passed
JobSchema.methods.isExpired = function () {
	return this.applicationDeadline < new Date();
};

module.exports = mongoose.model("Job", JobSchema);
