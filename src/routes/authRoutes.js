
const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");

const validate = require("../middleware/validate");

const {
  requireAuth
} = require("../middleware/authMiddleware");

const controller = require("../controllers/authController");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const registerSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  phone: z.string().max(30).optional()
}).strict();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
}).strict();

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
}).strict();

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  controller.register
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  controller.login
);

router.post(
  "/refresh",
  authLimiter,
  validate(refreshSchema),
  controller.refresh
);

router.post(
  "/logout",
  requireAuth,
  validate(refreshSchema),
  controller.logout
);

router.get(
  "/me",
  requireAuth,
  controller.me
);

module.exports = router;
