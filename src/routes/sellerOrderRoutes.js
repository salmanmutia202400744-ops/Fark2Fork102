
const express = require("express");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/sellerOrderController");

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("SELLER"));

router.get("/", controller.listOrders);
router.get("/:id", controller.getOrder);
router.get("/:id/status", controller.getStatus);

module.exports = router;
