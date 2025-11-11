const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/auth");
const {body} = require("express-validator");
const notificationController = require("../controllers/notification.controller");

router.use(protect);

// Get notifications
router.get("/", notificationController.getNotifications);

// Mark single notification as read
router.put("/:notificationId/read", notificationController.markAsRead);

// Mark all notifications as read
router.put("/read-all", notificationController.markAllAsRead);

// Delete single notification
router.delete("/:notificationId", notificationController.deleteNotification);

// Delete all notifications
router.delete("/", notificationController.deleteAllNotifications);

// Update notification preferences
router.put(
	"/preferences",
	[
		body("preferences").isObject(),
		body("preferences.email").isObject(),
		body("preferences.push").isObject(),
	],
	notificationController.updateNotificationPreferences
);

module.exports = router;
