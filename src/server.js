
const app = require("./app");
const env = require("./config/environment");
const { pool } = require("./config/database");

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(
    `Farm2Fork API running on port ${env.PORT}`
  );
});

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);

  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
