const express = require("express");
const { checkout } = require("../controllers/checkoutController");
const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  requireRole("CUSTOMER"),
  checkout
);

module.exports = router;