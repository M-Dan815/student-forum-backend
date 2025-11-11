const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/auth");
const {body} = require("express-validator");
const threadController = require("../controllers/thread.controller");

// Public routes
router.get("/search", threadController.searchThreads);
router.get("/:threadId", threadController.getThread);

// Protected routes
router.use(protect);

router.post(
	"/",
	[
		body("title").notEmpty().trim().isLength({max: 200}),
		body("content").notEmpty(),
		body("forumId").isMongoId(),
	],
	threadController.createThread
);

router.post(
	"/:threadId/reply",
	[body("content").notEmpty()],
	threadController.replyToThread
);

router.post("/:threadId/vote", threadController.voteThread);
router.post("/:threadId/replies/:replyId/vote", threadController.voteReply);
router.delete("/:threadId", threadController.deleteThread);

module.exports = router;
