const Thread = require("../models/Thread");
const Forum = require("../models/Forum");
const Notification = require("../models/Notification");
const {validationResult} = require("express-validator");

exports.createThread = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const {title, content, forumId, tags} = req.body;

		const forum = await Forum.findById(forumId);
		if (!forum) {
			return res.status(404).json({
				success: false,
				message: "Forum not found",
			});
		}

		const thread = new Thread({
			title,
			content,
			author: req.user._id,
			forum: forumId,
			tags,
		});

		await thread.save();

		// Update forum statistics
		await Forum.findByIdAndUpdate(forumId, {
			$inc: {threadCount: 1},
			lastPost: {
				thread: thread._id,
				user: req.user._id,
				date: new Date(),
			},
		});

		await thread.populate("author", "name avatar");

		res.status(201).json({
			success: true,
			message: "Thread created successfully",
			thread,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error creating thread",
			error: error.message,
		});
	}
};

exports.getThread = async (req, res) => {
	try {
		const {threadId} = req.params;

		const thread = await Thread.findByIdAndUpdate(
			threadId,
			{$inc: {views: 1}},
			{new: true}
		)
			.populate("author", "name avatar")
			.populate("forum", "name")
			.populate("replies.author", "name avatar");

		if (!thread || thread.isDeleted) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		res.json({
			success: true,
			thread,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching thread",
			error: error.message,
		});
	}
};

exports.replyToThread = async (req, res) => {
	try {
		const {threadId} = req.params;
		const {content} = req.body;

		const thread = await Thread.findById(threadId);

		if (!thread || thread.isDeleted) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		if (thread.isLocked) {
			return res.status(403).json({
				success: false,
				message: "Thread is locked",
			});
		}

		const reply = {
			content,
			author: req.user._id,
			createdAt: new Date(),
		};

		thread.replies.push(reply);
		thread.lastActivity = new Date();
		await thread.save();

		// Update forum post count
		await Forum.findByIdAndUpdate(thread.forum, {
			$inc: {postCount: 1},
			lastPost: {
				thread: thread._id,
				user: req.user._id,
				date: new Date(),
			},
		});

		// Create notification for thread author
		if (thread.author.toString() !== req.user._id.toString()) {
			await Notification.create({
				user: thread.author,
				type: "reply",
				message: `${req.user.name} replied to your thread`,
				link: `/threads/${thread._id}`,
				from: req.user._id,
			});
		}

		res.status(201).json({
			success: true,
			message: "Reply posted successfully",
			reply: thread.replies[thread.replies.length - 1],
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error posting reply",
			error: error.message,
		});
	}
};

exports.voteThread = async (req, res) => {
	try {
		const {threadId} = req.params;
		const {voteType} = req.body; // 'upvote' or 'downvote'

		const thread = await Thread.findById(threadId);

		if (!thread || thread.isDeleted) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		const userId = req.user._id.toString();

		// Remove existing vote
		thread.upvotes = thread.upvotes.filter((id) => id.toString() !== userId);
		thread.downvotes = thread.downvotes.filter(
			(id) => id.toString() !== userId
		);

		// Add new vote
		if (voteType === "upvote") {
			thread.upvotes.push(userId);
		} else if (voteType === "downvote") {
			thread.downvotes.push(userId);
		}

		await thread.save();

		res.json({
			success: true,
			message: "Vote recorded successfully",
			upvotes: thread.upvotes.length,
			downvotes: thread.downvotes.length,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error voting on thread",
			error: error.message,
		});
	}
};

exports.voteReply = async (req, res) => {
	try {
		const {threadId, replyId} = req.params;
		const {voteType} = req.body;

		const thread = await Thread.findById(threadId);

		if (!thread || thread.isDeleted) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		const reply = thread.replies.id(replyId);

		if (!reply || reply.isDeleted) {
			return res.status(404).json({
				success: false,
				message: "Reply not found",
			});
		}

		const userId = req.user._id.toString();

		// Remove existing vote
		reply.upvotes = reply.upvotes.filter((id) => id.toString() !== userId);
		reply.downvotes = reply.downvotes.filter((id) => id.toString() !== userId);

		// Add new vote
		if (voteType === "upvote") {
			reply.upvotes.push(userId);
		} else if (voteType === "downvote") {
			reply.downvotes.push(userId);
		}

		await thread.save();

		res.json({
			success: true,
			message: "Vote recorded successfully",
			upvotes: reply.upvotes.length,
			downvotes: reply.downvotes.length,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error voting on reply",
			error: error.message,
		});
	}
};

exports.deleteThread = async (req, res) => {
	try {
		const {threadId} = req.params;

		const thread = await Thread.findById(threadId);

		if (!thread) {
			return res.status(404).json({
				success: false,
				message: "Thread not found",
			});
		}

		// Check permissions
		const canDelete =
			req.user._id.toString() === thread.author.toString() ||
			req.user.role === "admin" ||
			req.user.role === "moderator";

		if (!canDelete) {
			return res.status(403).json({
				success: false,
				message: "Not authorized to delete this thread",
			});
		}

		thread.isDeleted = true;
		thread.deletedBy = req.user._id;
		await thread.save();

		// Update forum statistics
		await Forum.findByIdAndUpdate(thread.forum, {
			$inc: {threadCount: -1},
		});

		res.json({
			success: true,
			message: "Thread deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error deleting thread",
			error: error.message,
		});
	}
};

exports.searchThreads = async (req, res) => {
	try {
		const {query, forum, author, tags, page = 1, limit = 20} = req.query;

		let searchQuery = {isDeleted: false};

		if (query) {
			searchQuery.$text = {$search: query};
		}
		if (forum) {
			searchQuery.forum = forum;
		}
		if (author) {
			searchQuery.author = author;
		}
		if (tags) {
			searchQuery.tags = {$in: tags.split(",")};
		}

		const threads = await Thread.find(searchQuery)
			.populate("author", "name avatar")
			.populate("forum", "name")
			.sort("-lastActivity")
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await Thread.countDocuments(searchQuery);

		res.json({
			success: true,
			threads,
			pagination: {
				total,
				pages: Math.ceil(total / limit),
				current: page,
				limit,
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error searching threads",
			error: error.message,
		});
	}
};
