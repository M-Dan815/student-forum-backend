const {body, query, param} = require("express-validator");

exports.registerValidator = [
	body("name")
		.trim()
		.notEmpty()
		.withMessage("Name is required")
		.isLength({max: 50})
		.withMessage("Name cannot exceed 50 characters"),
	body("email")
		.trim()
		.notEmpty()
		.withMessage("Email is required")
		.isEmail()
		.withMessage("Please provide a valid email")
		.normalizeEmail(),
	body("password")
		.notEmpty()
		.withMessage("Password is required")
		.isLength({min: 6})
		.withMessage("Password must be at least 6 characters"),
];

exports.loginValidator = [
	body("email")
		.trim()
		.notEmpty()
		.withMessage("Email is required")
		.isEmail()
		.withMessage("Please provide a valid email")
		.normalizeEmail(),
	body("password").notEmpty().withMessage("Password is required"),
];

exports.jobValidator = [
	body("title")
		.trim()
		.notEmpty()
		.withMessage("Job title is required")
		.isLength({max: 100})
		.withMessage("Title cannot exceed 100 characters"),
	body("company")
		.trim()
		.notEmpty()
		.withMessage("Company name is required")
		.isLength({max: 100})
		.withMessage("Company name cannot exceed 100 characters"),
	body("description")
		.trim()
		.notEmpty()
		.withMessage("Job description is required")
		.isLength({max: 5000})
		.withMessage("Description cannot exceed 5000 characters"),
	body("requirements")
		.isArray({min: 1})
		.withMessage("At least one requirement is needed"),
	body("responsibilities")
		.isArray({min: 1})
		.withMessage("At least one responsibility is needed"),
	body("location").trim().notEmpty().withMessage("Location is required"),
	body("jobType")
		.notEmpty()
		.withMessage("Job type is required")
		.isIn(["Internship", "Full-time", "Part-time", "Remote", "Contract"])
		.withMessage("Invalid job type"),
	body("category").notEmpty().withMessage("Category is required"),
	body("applicationDeadline")
		.notEmpty()
		.withMessage("Application deadline is required")
		.isISO8601()
		.withMessage("Invalid date format")
		.custom((value) => {
			if (new Date(value) < new Date()) {
				throw new Error("Application deadline must be in the future");
			}
			return true;
		}),
	body("contactEmail")
		.trim()
		.notEmpty()
		.withMessage("Contact email is required")
		.isEmail()
		.withMessage("Please provide a valid email"),
];

exports.applicationValidator = [
	body("applicantName")
		.trim()
		.notEmpty()
		.withMessage("Name is required")
		.isLength({max: 100})
		.withMessage("Name cannot exceed 100 characters"),
	body("applicantEmail")
		.trim()
		.notEmpty()
		.withMessage("Email is required")
		.isEmail()
		.withMessage("Please provide a valid email")
		.normalizeEmail(),
	body("applicantPhone")
		.trim()
		.notEmpty()
		.withMessage("Phone number is required"),
	body("resumeUrl")
		.trim()
		.notEmpty()
		.withMessage("Resume URL is required")
		.isURL()
		.withMessage("Please provide a valid URL"),
	body("coverLetter")
		.optional()
		.trim()
		.isLength({max: 2000})
		.withMessage("Cover letter cannot exceed 2000 characters"),
];

exports.searchJobsValidator = [
	query("search").optional().trim(),
	query("company").optional().trim(),
	query("location").optional().trim(),
	query("jobType")
		.optional()
		.isIn(["Internship", "Full-time", "Part-time", "Remote", "Contract"]),
	query("category").optional().trim(),
	query("page")
		.optional()
		.isInt({min: 1})
		.withMessage("Page must be a positive integer"),
	query("limit")
		.optional()
		.isInt({min: 1, max: 100})
		.withMessage("Limit must be between 1 and 100"),
];

exports.idValidator = [
	param("id").isMongoId().withMessage("Invalid ID format"),
];
