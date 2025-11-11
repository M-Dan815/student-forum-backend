const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/auth");
const {body} = require("express-validator");
const userController = require("../controllers/user.controller");

// Public routes
router.get("/:userId/profile", userController.getProfile);

// Protected routes
router.use(protect);

router.put(
	"/profile",
	[
		body("username").optional().trim().isLength({min: 3, max: 30}),
		body("email").optional().isEmail().normalizeEmail(),
	],
	userController.updateProfile
);

// Blocking functionality
router.post("/:userToBlockId/block", userController.blockUser);
router.delete("/:userToUnblockId/unblock", userController.unblockUser);
router.get("/blocked", userController.getBlockedUsers);

// Reporting functionality
router.post(
	"/:userToReportId/report",
	[
		body("reason").isIn([
			"spam",
			"harassment",
			"inappropriate",
			"misinformation",
			"other",
		]),
		body("description").optional().trim(),
	],
	userController.reportUser
);

router.post(
	"/report-content",
	[
		body("contentType").isIn(["thread", "reply", "message"]),
		body("contentId").isMongoId(),
		body("reason").isIn([
			"spam",
			"harassment",
			"inappropriate",
			"misinformation",
			"other",
		]),
		body("description").optional().trim(),
	],
	userController.reportContent
);

module.exports = router;
