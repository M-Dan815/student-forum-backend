const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
	// Accept only PDFs
	if (file.mimetype === "application/pdf") {
		cb(null, true);
	} else {
		cb(new Error("Only PDF files are allowed"), false);
	}
};

const upload = multer({
	storage: storage,
	limits: {
		fileSize: (parseInt(process.env.MAX_CV_SIZE_MB) || 5) * 1024 * 1024, // Default 5MB
	},
	fileFilter: fileFilter,
});

module.exports = upload;
