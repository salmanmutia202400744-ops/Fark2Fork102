
const app = require("./app");
const env = require("./config/environment");
const { pool } = require("./config/database");

const {
  startInventoryCleanupJob,
  stopInventoryCleanupJob
} = require("./jobs/expireReservations");

// Start Express server
const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(
    `Farm2Fork API running on port ${env.PORT}`
  );

  // Start automatic inventory cleanup
  startInventoryCleanupJob();
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);

  // Stop scheduling new cleanup runs
  stopInventoryCleanupJob();

  server.close(async () => {
    try {
      await pool.end();

      console.log("Farm2Fork server stopped.");

      process.exit(0);
    } catch (error) {
      console.error(
        "Shutdown error:",
        error.message
      );

      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
