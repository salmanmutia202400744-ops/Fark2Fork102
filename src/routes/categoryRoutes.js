
const express = require("express");
const controller = require("../controllers/productController");

const router = express.Router();

router.get("/", controller.categories);

module.exports = router;
