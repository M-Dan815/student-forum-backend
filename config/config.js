require("dotenv").config();

module.exports = {
	env: process.env.NODE_ENV || "development",
	port: process.env.PORT || 5000,
	mongodb: {
		uri:
			process.env.NODE_ENV === "production"
				? process.env.MONGODB_URI_PROD
				: process.env.MONGODB_URI,
		options: {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		},
	},
	jwt: {
		secret: process.env.JWT_SECRET,
		expire: process.env.JWT_EXPIRE,
		cookieExpire: process.env.JWT_COOKIE_EXPIRE,
	},
	admin: {
		email: process.env.ADMIN_EMAIL,
		password: process.env.ADMIN_PASSWORD,
	},
	cors: {
		origin: process.env.CLIENT_URL || "http://localhost:3000",
		credentials: true,
	},
	cloudinary: {
		cloudName: process.env.CLOUDINARY_CLOUD_NAME,
		apiKey: process.env.CLOUDINARY_API_KEY,
		apiSecret: process.env.CLOUDINARY_API_SECRET, // Changed from api_secret to apiSecret
	},
	email: {
		host: process.env.EMAIL_HOST || "smtp.gmail.com",
		port: process.env.EMAIL_PORT || 587,
		secure: process.env.EMAIL_SECURE === "true", // Convert string to boolean
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
		from: process.env.EMAIL_FROM || process.env.EMAIL_USER, // Added missing property
		fromName: process.env.EMAIL_FROM_NAME || "Student Forum", // Added missing property
	},
	client: {
		// Added missing client configuration
		url: process.env.CLIENT_URL || "http://localhost:3000",
	},
};
