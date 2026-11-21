
const express = require("express");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/sellerOrderController");

const router = express.Router();

// Only authenticated sellers can access these routes
router.use(requireAuth);
router.use(requireRole("SELLER"));

// View all seller orders
router.get("/", controller.listOrders);

// View individual seller order
router.get("/:id", controller.getOrder);

// View seller order status
router.get("/:id/status", controller.getStatus);

module.exports = router;
