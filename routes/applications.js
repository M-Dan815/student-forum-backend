const express = require("express");
const {
	submitApplication,
	getApplications,
	getJobApplications,
	getApplication,
	updateApplicationStatus,
	deleteApplication,
	getApplicationStats,
} = require("../controllers/applicationController");
const {protect, authorize} = require("../middleware/auth");
const {validate} = require("../middleware/validation");
const {applicationValidator, idValidator} = require("../utils/validators");

const router = express.Router();

// Public routes
router.post("/", applicationValidator, validate, submitApplication);

// Admin routes
router.use(protect);
router.use(authorize("admin"));

router.get("/", getApplications);
router.get("/stats/overview", getApplicationStats);
router.get("/job/:jobId", idValidator, validate, getJobApplications);
router.get("/:id", idValidator, validate, getApplication);
router.put("/:id", idValidator, validate, updateApplicationStatus);
router.delete("/:id", idValidator, validate, deleteApplication);

module.exports = router;
