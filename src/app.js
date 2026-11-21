
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const env = require("./config/environment");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const sellerRoutes = require("./routes/sellerRoutes");

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

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

// Register raw-body payment webhook routes here
// before express.json() when implementing Maya.

app.use(express.json({ limit: "1mb" }));

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

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/seller", sellerRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
