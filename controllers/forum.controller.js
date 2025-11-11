const Forum = require("../models/Forum");
const Thread = require("../models/Thread");
const {validationResult} = require("express-validator");

exports.getForums = async (req, res) => {
	try {
		const forums = await Forum.find({isActive: true})
			.populate("moderators", "username")
			.populate("lastPost.user", "username")
			.sort("order");

		res.json({
			success: true,
			forums,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching forums",
			error: error.message,
		});
	}
};

exports.getForum = async (req, res) => {
	try {
		const {forumId} = req.params;
		const {page = 1, limit = 20, sort = "-lastActivity"} = req.query;

		const forum = await Forum.findById(forumId).populate(
			"moderators",
			"username avatar"
		);

		if (!forum) {
			return res.status(404).json({
				success: false,
				message: "Forum not found",
			});
		}

		const threads = await Thread.find({forum: forumId, isDeleted: false})
			.populate("author", "username avatar")
			.sort(sort)
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const totalThreads = await Thread.countDocuments({
			forum: forumId,
			isDeleted: false,
		});

		res.json({
			success: true,
			forum,
			threads,
			pagination: {
				total: totalThreads,
				pages: Math.ceil(totalThreads / limit),
				current: page,
				limit,
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching forum",
			error: error.message,
		});
	}
};

exports.createForum = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const {name, description, category, icon, moderators} = req.body;

		const forum = new Forum({
			name,
			description,
			category,
			icon,
			moderators,
		});

		await forum.save();

		res.status(201).json({
			success: true,
			message: "Forum created successfully",
			forum,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error creating forum",
			error: error.message,
		});
	}
};

exports.updateForum = async (req, res) => {
	try {
		const {forumId} = req.params;
		const updates = req.body;

		const forum = await Forum.findByIdAndUpdate(forumId, updates, {
			new: true,
			runValidators: true,
		});

		if (!forum) {
			return res.status(404).json({
				success: false,
				message: "Forum not found",
			});
		}

		res.json({
			success: true,
			message: "Forum updated successfully",
			forum,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error updating forum",
			error: error.message,
		});
	}
};
