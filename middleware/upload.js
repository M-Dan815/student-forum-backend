const multer = require("multer");
const {CloudinaryStorage} = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
	cloudinary: cloudinary,
	params: {
		folder: "profile-photos",
		allowed_formats: ["jpg", "jpeg", "png", "gif"],
		transformation: [{width: 500, height: 500, crop: "fill", quality: "auto"}],
	},
});

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max
	},
	fileFilter: (req, file, cb) => {
		if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
			return cb(new Error("Only image files are allowed!"), false);
		}
		cb(null, true);
	},
});

module.exports = upload;
