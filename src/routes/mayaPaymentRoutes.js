
const express = require("express");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const {
  createCheckout
} = require("../controllers/mayaPaymentController");

const router = express.Router();

router.post(
  "/maya/checkout",
  requireAuth,
  requireRole("CUSTOMER"),
  createCheckout
);

module.exports = router;
