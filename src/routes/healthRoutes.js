
const express = require("express");
const { query } = require("../config/database");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      service: "Farm2Fork API",
      status: "running",
      timestamp: new Date().toISOString()
    }
  });
});

router.get("/database", async (req, res, next) => {
  try {
    const result = await query(
      "SELECT NOW() AS server_time"
    );

    res.json({
      success: true,
      data: {
        database: "connected",
        serverTime: result.rows[0].server_time
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
