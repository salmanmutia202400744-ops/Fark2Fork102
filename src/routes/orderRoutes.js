
const express = require("express");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/orderController");

const router = express.Router();

// All endpoints require an authenticated customer.
router.use(requireAuth);
router.use(requireRole("CUSTOMER"));

// Customer order history
router.get("/", controller.listOrders);

// Individual order details
router.get("/:id", controller.getOrder);

// Order status
router.get("/:id/status", controller.getStatus);

// Cancellation is intentionally disabled until
// paymentService.js locking is verified.
// router.post("/:id/cancel", controller.cancel);

module.exports = router;
