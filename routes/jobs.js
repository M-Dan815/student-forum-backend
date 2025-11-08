const express = require("express");
const {
	getJobs,
	getAllJobsAdmin,
	getJob,
	createJob,
	updateJob,
	deleteJob,
	toggleJobStatus,
	getJobStats,
	searchJobs,
} = require("../controllers/jobController");
const {protect, authorize} = require("../middleware/auth");
const {validate} = require("../middleware/validation");
const {
	jobValidator,
	searchJobsValidator,
	idValidator,
} = require("../utils/validators");

const router = express.Router();

// Public routes
router.get("/", getJobs);
router.get("/search", searchJobsValidator, validate, searchJobs);
router.get("/:id", idValidator, validate, getJob);

// Admin routes
router.use(protect);
router.use(authorize("admin"));

router.get("/admin/all", getAllJobsAdmin);
router.get("/stats/overview", getJobStats);
router.post("/", jobValidator, validate, createJob);
router.put("/:id", idValidator, validate, updateJob);
router.delete("/:id", idValidator, validate, deleteJob);
router.put("/:id/toggle-status", idValidator, validate, toggleJobStatus);

module.exports = router;
