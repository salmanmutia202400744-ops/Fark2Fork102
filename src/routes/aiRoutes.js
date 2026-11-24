const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/aiController");

const router = express.Router();

router.use(requireAuth);

// Protect AI API usage
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,

  keyGenerator: (req) => req.user.id,

  message: {
    success: false,
    message: "Please wait before sending another message."
  },

  standardHeaders: "draft-7",
  legacyHeaders: false
});

// AI conversation
router.post(
  "/chat",
  aiLimiter,
  controller.chat
);

router.get(
  "/conversations",
  controller.conversations
);

router.get(
  "/conversations/:id/messages",
  controller.messages
);

router.delete(
  "/conversations/:id",
  controller.removeConversation
);

// Customer recipe book
router.get(
  "/recipes",
  requireRole("CUSTOMER"),
  controller.recipes
);

router.post(
  "/recipes",
  requireRole("CUSTOMER"),
  controller.saveRecipe
);

router.delete(
  "/recipes/:id",
  requireRole("CUSTOMER"),
  controller.removeRecipe
);

// Seller restocking
router.post(
  "/restock",
  requireRole("SELLER"),
  controller.restock
);

module.exports = router;