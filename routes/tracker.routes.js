const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/auth");
const {body, query} = require("express-validator");
const {
	getTrackedApplications,
	getTrackedApplication,
	createTrackedApplication,
	createFromPlatformApplication,
	updateTrackedApplication,
	updateTrackedStatus,
	deleteTrackedApplication,
	bulkActions,
	getTrackingStatistics,
	addReminder,
	exportTrackedApplications,
} = require("../controllers/tracker.controller");

// Protect all routes - only logged-in students can use tracker
router.use(protect);

// Statistics and export
router.get("/stats", getTrackingStatistics);
router.get("/export", exportTrackedApplications);

// Main CRUD operations
router
	.route("/")
	.get(getTrackedApplications)
	.post(
		[
			body("company.name").notEmpty().trim(),
			body("job.title").notEmpty().trim(),
			body("status").isIn([
				"to_apply",
				"applied",
				"interview_scheduled",
				"offer_received",
				"rejected",
				"withdrawn",
			]),
		],
		createTrackedApplication
	);

// Create tracker from existing platform application
router.post("/from-application/:applicationId", createFromPlatformApplication);

// Bulk actions
router.post(
	"/bulk",
	[
		body("action").isIn(["archive", "unarchive", "delete"]),
		body("trackerIds").isArray(),
	],
	bulkActions
);

// Single tracked application operations
router
	.route("/:id")
	.get(getTrackedApplication)
	.put(updateTrackedApplication)
	.delete(deleteTrackedApplication);

// Status update (for Kanban drag & drop)
router.patch(
	"/:id/status",
	[
		body("status").isIn([
			"to_apply",
			"applied",
			"interview_scheduled",
			"offer_received",
			"rejected",
			"withdrawn",
		]),
	],
	updateTrackedStatus
);

// Reminders
router.post(
	"/:id/reminders",
	[body("title").notEmpty(), body("date").isISO8601()],
	addReminder
);

module.exports = router;
