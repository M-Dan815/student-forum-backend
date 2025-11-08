const express = require("express");
const {
	register,
	login,
	getMe,
	updateDetails,
	updatePassword,
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

module.exports = router;
