const express = require("express");
const {
	register,
	login,
	getMe,
	updateDetails,
	updatePassword,
	updateAvatar,
	updateNotificationPreferences,
	getUserStats,
	logout,
} = require("../controllers/authController");
const {protect} = require("../middleware/auth");
const {validate} = require("../middleware/validation");
const {registerValidator, loginValidator} = require("../utils/validators");

const router = express.Router();

router.post("/register", registerValidator, validate, register);
router.post("/login", loginValidator, validate, login);
router.get("/me", protect, getMe);
router.put("/updatedetails", protect, updateDetails);
router.put("/updatepassword", protect, updatePassword);

// Additional routes for forum features
router.post("/logout", logout);
router.put("/avatar", protect, updateAvatar);
router.put("/notifications", protect, updateNotificationPreferences);
router.get("/stats", protect, getUserStats);

module.exports = router;
