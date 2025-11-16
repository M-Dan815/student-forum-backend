const mongoose = require("mongoose");

const trackerSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		// If this application was submitted through the platform, link it
		platformApplication: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Application",
		},
		company: {
			name: {
				type: String,
				required: [true, "Company name is required"],
				trim: true,
			},
			website: String,
			location: String,
			industry: String,
			size: {
				type: String,
				enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+", ""],
			},
		},
		job: {
			title: {
				type: String,
				required: [true, "Job title is required"],
				trim: true,
			},
			description: String,
			link: String,
			type: {
				type: String,
				enum: [
					"Full-time",
					"Part-time",
					"Internship",
					"Co-op",
					"Contract",
					"Freelance",
				],
				default: "Full-time",
			},
			location: String,
			remote: {
				type: String,
				enum: ["On-site", "Remote", "Hybrid"],
				default: "On-site",
			},
			salary: {
				min: Number,
				max: Number,
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
		},
		status: {
			type: String,
			enum: [
				"to_apply",
				"applied",
				"interview_scheduled",
				"offer_received",
				"rejected",
				"withdrawn",
			],
			default: "to_apply",
			required: true,
		},
		statusHistory: [
			{
				status: String,
				date: {
					type: Date,
					default: Date.now,
				},
				notes: String,
			},
		],
		dates: {
			deadline: Date,
			applied: Date,
			lastUpdated: {
				type: Date,
				default: Date.now,
			},
		},
		interviews: [
			{
				round: {
					type: Number,
					default: 1,
				},
				type: {
					type: String,
					enum: [
						"Phone",
						"Video",
						"On-site",
						"Technical",
						"Behavioral",
						"Panel",
						"Case Study",
					],
				},
				date: Date,
				time: String,
				duration: Number, // in minutes
				location: String,
				meetingLink: String,
				interviewer: {
					name: String,
					title: String,
					email: String,
					phone: String,
					linkedin: String,
				},
				notes: String,
				completed: {
					type: Boolean,
					default: false,
				},
				outcome: {
					type: String,
					enum: ["Passed", "Failed", "Pending", ""],
					default: "",
				},
			},
		],
		contacts: [
			{
				name: String,
				title: String,
				email: String,
				phone: String,
				linkedin: String,
				role: {
					type: String,
					enum: ["Recruiter", "Hiring Manager", "HR", "Referral", "Other"],
				},
				notes: String,
				lastContacted: Date,
			},
		],
		documents: {
			resume: {
				version: String,
				url: String,
				uploadedAt: Date,
			},
			coverLetter: {
				url: String,
				uploadedAt: Date,
			},
			portfolio: String,
			others: [
				{
					name: String,
					url: String,
					type: String,
					uploadedAt: Date,
				},
			],
		},
		offer: {
			received: {
				type: Boolean,
				default: false,
			},
			date: Date,
			salary: {
				amount: Number,
				currency: String,
				period: String,
			},
			benefits: [String],
			startDate: Date,
			deadline: Date,
			accepted: {
				type: Boolean,
				default: false,
			},
			negotiated: {
				type: Boolean,
				default: false,
			},
			finalSalary: {
				amount: Number,
				currency: String,
				period: String,
			},
		},
		reminders: [
			{
				type: {
					type: String,
					enum: ["follow_up", "interview", "deadline", "custom"],
				},
				title: String,
				description: String,
				date: Date,
				time: String,
				completed: {
					type: Boolean,
					default: false,
				},
				notificationSent: {
					type: Boolean,
					default: false,
				},
			},
		],
		notes: {
			general: String,
			nextSteps: String,
			whyInterested: String,
			questions: [String],
			prosAndCons: {
				pros: [String],
				cons: [String],
			},
		},
		priority: {
			type: String,
			enum: ["low", "medium", "high"],
			default: "medium",
		},
		tags: [String],
		archived: {
			type: Boolean,
			default: false,
		},
		metadata: {
			source: {
				type: String,
				enum: [
					"LinkedIn",
					"Indeed",
					"Glassdoor",
					"Company Website",
					"Referral",
					"Career Fair",
					"Platform",
					"Other",
				],
			},
			referredBy: {
				name: String,
				relationship: String,
			},
		},
		score: {
			interest: {
				type: Number,
				min: 1,
				max: 5,
			},
			fitScore: {
				type: Number,
				min: 1,
				max: 5,
			},
			likelihood: {
				type: Number,
				min: 1,
				max: 5,
			},
		},
		position: {
			type: Number,
			default: 0, // For Kanban board ordering
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
trackerSchema.index({user: 1, status: 1});
trackerSchema.index({user: 1, "dates.deadline": 1});
trackerSchema.index({user: 1, "company.name": 1});
trackerSchema.index({user: 1, archived: 1});
trackerSchema.index({user: 1, createdAt: -1});

// Update lastUpdated on save
trackerSchema.pre("save", function (next) {
	this.dates.lastUpdated = Date.now();

	// Add to status history if status changed
	if (this.isModified("status")) {
		this.statusHistory.push({
			status: this.status,
			date: new Date(),
		});
	}

	next();
});

// Virtual for days until deadline
trackerSchema.virtual("daysUntilDeadline").get(function () {
	if (!this.dates.deadline) return null;
	const now = new Date();
	const deadline = new Date(this.dates.deadline);
	const diffTime = deadline - now;
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
});

// Virtual for application age
trackerSchema.virtual("applicationAge").get(function () {
	if (!this.dates.applied) return null;
	const now = new Date();
	const applied = new Date(this.dates.applied);
	const diffTime = now - applied;
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
});

module.exports = mongoose.model("Tracker", trackerSchema);
