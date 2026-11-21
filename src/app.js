
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const env = require("./config/environment");

// Import routes
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const mayaPaymentRoutes = require("./routes/mayaPaymentRoutes");
const addressRoutes = require("./routes/addressRoutes");

// Error handlers
const {
  requestId,
  notFound,
  errorHandler
} = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = env.ALLOWED_ORIGINS
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(requestId);
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("CORS origin not allowed");
      error.status = 403;
      error.code = "CORS_FORBIDDEN";

      return callback(error);
    }
  })
);

// General API rate limit
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

// Register raw-body Maya webhook routes here
// when implementing verified webhook handling.

app.use(express.json({ limit: "1mb" }));

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      name: "Farm2Fork Backend",
      version: "1.0.0",
      api: "/api/v1"
    }
  });
});

// Health
app.use("/api/v1/health", healthRoutes);

// Authentication
app.use("/api/v1/auth", authRoutes);

// Categories and products
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);

// Shopping cart
app.use("/api/v1/cart", cartRoutes);

// Seller management
app.use("/api/v1/seller", sellerRoutes);

// Customer checkout
app.use("/api/v1/checkout", checkoutRoutes);

// Maya payments
app.use("/api/v1/payments", mayaPaymentRoutes);

// Customer delivery addresses
app.use("/api/v1/addresses", addressRoutes);

// Error handlers must always be last
app.use(notFound);
app.use(errorHandler);

module.exports = app;
