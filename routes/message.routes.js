const express = require("express");
const router = express.Router();
const {protect} = require("../middleware/auth");
const {body} = require("express-validator");
const messageController = require("../controllers/message.controller");

router.use(protect);

router.get("/conversations", messageController.getConversations);
router.get("/conversations/:conversationId", messageController.getMessages);
router.get("/unread-count", messageController.getUnreadCount);

router.post(
	"/send",
	[body("recipientId").isMongoId(), body("content").notEmpty()],
	messageController.sendMessage
);

router.put("/:messageId/read", messageController.markAsRead);
router.delete("/:messageId", messageController.deleteMessage);

module.exports = router;
