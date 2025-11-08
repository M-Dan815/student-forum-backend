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
};
