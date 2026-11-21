
const express = require("express");
const { z } = require("zod");

const validate = require("../middleware/validate");

const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/cartController");

const router = express.Router();

const uuid = z.string().uuid();

const addSchema = z.object({
  product_id: uuid,
  quantity: z.number().int().positive().max(10000)
}).strict();

const updateSchema = z.object({
  quantity: z.number().int().positive().max(10000)
}).strict();

router.use(requireAuth, requireRole("CUSTOMER"));

router.get("/", controller.get);

router.post(
  "/items",
  validate(addSchema),
  controller.add
);

router.patch(
  "/items/:id",
  validate(z.object({ id: uuid }), "params"),
  validate(updateSchema),
  controller.update
);

router.delete(
  "/items/:id",
  validate(z.object({ id: uuid }), "params"),
  controller.remove
);

module.exports = router;
