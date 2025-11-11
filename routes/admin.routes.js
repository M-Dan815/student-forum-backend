const express = require("express");
const router = express.Router();
const {protect, authorize} = require("../middleware/auth");
const adminController = require("../controllers/admin.controller");

router.use(protect);
router.use(authorize("admin", "moderator"));

// Reports management
router.get("/reports", adminController.getReports);
router.get("/reports/:reportId", adminController.getReport);
router.put("/reports/:reportId", adminController.updateReport);

// User management
router.get("/users", adminController.getUsers);
router.put("/users/:userId/warn", adminController.warnUser);
router.put("/users/:userId/suspend", adminController.suspendUser);
router.put("/users/:userId/ban", adminController.banUser);
router.put("/users/:userId/unban", adminController.unbanUser);

// Content moderation
router.delete("/threads/:threadId", adminController.deleteThread);
router.delete("/messages/:messageId", adminController.deleteMessage);
router.put("/threads/:threadId/lock", adminController.lockThread);
router.put("/threads/:threadId/pin", adminController.pinThread);

// Statistics
router.get("/stats", adminController.getStatistics);

module.exports = router;
