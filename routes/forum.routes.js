const express = require("express");
const router = express.Router();
const {protect, authorize} = require("../middleware/auth");
const {body} = require("express-validator");
const forumController = require("../controllers/forum.controller");

// Public routes
router.get("/", forumController.getForums);
router.get("/:forumId", forumController.getForum);

// Protected routes
router.use(protect);

// Admin only routes
router.post(
	"/",
	authorize("admin"),
	[
		body("name").notEmpty().trim(),
		body("description").notEmpty(),
		body("category").isIn([
			"Careers",
			"Study Help",
			"Interests",
			"General",
			"Announcements",
		]),
	],
	forumController.createForum
);

router.put(
	"/:forumId",
	authorize("admin", "moderator"),
	forumController.updateForum
);

module.exports = router;
