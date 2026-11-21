
const express = require("express");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/orderController");

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("CUSTOMER"));

// Customer order history
router.get("/", controller.listOrders);

// Individual order details
router.get("/:id", controller.getOrder);

// Current order status
router.get("/:id/status", controller.getStatus);

// Cancel an eligible unpaid order
router.post("/:id/cancel", controller.cancel);

module.exports = router;
