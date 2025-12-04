const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/auth");
const upload = require("../middleware/cvUpload");
const {
	analyzeCV,
	getReviewHistory,
	getReview,
	compareVersions,
	downloadFeedback,
	deleteReview,
	provideFeedback,
	getStats,
} = require("../controllers/cvreview.controller");

// All routes are protected
router.use(protect);

// CV analysis
router.post("/analyze", upload.single("cv"), analyzeCV);

// Review history and stats
router.get("/history", getReviewHistory);
router.get("/stats", getStats);

// Compare versions
router.get("/compare", compareVersions);

// Single review operations
router.route("/:id").get(getReview).delete(deleteReview);

// Feedback
router.post("/:id/feedback", provideFeedback);
router.get("/:id/download", downloadFeedback);

module.exports = router;
