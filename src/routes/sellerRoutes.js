
const express = require("express");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/productController");

const router = express.Router();

router.use(requireAuth, requireRole("SELLER"));

router.get("/products", controller.ownProducts);

module.exports = router;
