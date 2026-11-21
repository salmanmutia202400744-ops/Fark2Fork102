
const express = require("express");
const { z } = require("zod");

const validate = require("../middleware/validate");
const {
  requireAuth,
  requireRole
} = require("../middleware/authMiddleware");

const controller = require("../controllers/productController");
const inventory = require("../services/inventoryService");

const router = express.Router();

const uuid = z.string().uuid();
const money = z.coerce.number().finite().nonnegative();

const productSchema = z.object({
  seller_id: uuid.optional(),
  category_id: uuid.nullable().optional(),
  name: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  price: money,
  stock_quantity: z.number().int().nonnegative().default(0),
  unit: z.string().trim().min(1).max(30),
  status: z.enum([
    "DRAFT", "ACTIVE", "ARCHIVED"
  ]).default("DRAFT"),
  origin: z.string().max(200).optional(),
  harvest_date: z.string().date().optional(),
  expiry_date: z.string().date().optional(),
  is_organic: z.boolean().default(false),
  minimum_order_quantity:
    z.number().int().positive().default(1),
  image_url: z.string().url().max(2000).optional()
}).strict();

const updateSchema = productSchema
  .omit({
    seller_id: true,
    stock_quantity: true,
    image_url: true
  })
  .partial();

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: uuid.optional(),
  minPrice: money.optional(),
  maxPrice: money.optional(),
  sort: z.enum([
    "newest",
    "price_asc",
    "price_desc",
    "name"
  ]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100)
    .default(12)
}).refine(
  (data) =>
    data.maxPrice === undefined ||
    data.minPrice === undefined ||
    data.maxPrice >= data.minPrice,
  { message: "maxPrice must be at least minPrice" }
);

const imageSchema = z.object({
  image_url: z.string().url().max(2000)
}).strict();

const stockSchema = z.object({
  change: z.number().int().refine(
    (value) => value !== 0,
    "Stock change cannot be zero."
  ),
  reason: z.string().trim().min(3).max(500)
}).strict();

router.get(
  "/",
  validate(listSchema, "query"),
  controller.list
);

router.get(
  "/:id",
  validate(z.object({ id: uuid }), "params"),
  controller.detail
);

router.post(
  "/",
  requireAuth,
  requireRole("SELLER", "ADMIN"),
  validate(productSchema),
  controller.create
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("SELLER", "ADMIN"),
  validate(z.object({ id: uuid }), "params"),
  validate(updateSchema),
  controller.update
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("SELLER", "ADMIN"),
  validate(z.object({ id: uuid }), "params"),
  controller.remove
);

router.post(
  "/:id/images",
  requireAuth,
  requireRole("SELLER", "ADMIN"),
  validate(z.object({ id: uuid }), "params"),
  validate(imageSchema),
  controller.addImage
);

router.delete(
  "/:id/images/:imageId",
  requireAuth,
  requireRole("SELLER", "ADMIN"),
  validate(
    z.object({ id: uuid, imageId: uuid }),
    "params"
  ),
  controller.deleteImage
);

router.post(
  "/:id/inventory",
  requireAuth,
  requireRole("SELLER", "ADMIN"),
  validate(z.object({ id: uuid }), "params"),
  validate(stockSchema),
  async (req, res, next) => {
    try {
      const data = await inventory.adjustStock(
        req.params.id,
        req.user,
        req.body
      );

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
