const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/auth");
const upload = require("../middleware/upload");
const {body} = require("express-validator");
const {
	registerStudent,
	verifyEmail,
	sendUniversityVerification,
	verifyUniversityEmail,
	uploadProfilePhoto,
	updateProfile,
	getProfileWizard,
	getPublicProfile,
	searchStudents,
	getProfileStats,
} = require("../controllers/profileController");

// Public routes
router.post(
	"/register",
	[
		body("name").notEmpty().trim().isLength({min: 2, max: 50}),
		body("email").isEmail().normalizeEmail(),
		body("password").isLength({min: 6}),
		body("universityName").notEmpty(),
		body("yearOfStudy").isIn([
			"Freshman",
			"Sophomore",
			"Junior",
			"Senior",
			"Graduate",
			"PhD",
			"Alumni",
		]),
		body("major").notEmpty(),
	],
	registerStudent
);

router.get("/verify-email/:token", verifyEmail);
router.get("/verify-university/:token", verifyUniversityEmail);
router.get("/search", searchStudents);
router.get("/user/:userId", getPublicProfile);

// Protected routes
router.use(protect);

router.post(
	"/verify-university",
	[body("universityEmail").isEmail()],
	sendUniversityVerification
);

router.post("/upload-photo", upload.single("photo"), uploadProfilePhoto);

router.put("/update", updateProfile);
router.get("/wizard", getProfileWizard);
router.get("/stats", getProfileStats);

module.exports = router;
