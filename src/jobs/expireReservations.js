
const {
  cleanupExpiredReservations
} = require("../services/inventoryReservationService");

const INTERVAL_MS = 60 * 1000;

let running = false;
let timer = null;

async function runInventoryCleanup() {
  if (running) return;

  running = true;

  try {
    const result = await cleanupExpiredReservations(50);

    if (result.restored > 0) {
      console.log("Inventory cleanup completed:", {
        checked: result.checked,
        restored: result.restored
      });
    }
  } catch (error) {
    console.error(
      "Inventory cleanup job failed:",
      error.message
    );
  } finally {
    running = false;
  }
}

function startInventoryCleanupJob() {
  if (timer) return;

  console.log(
    "Inventory cleanup job enabled: every 60 seconds"
  );

  timer = setInterval(
    runInventoryCleanup,
    INTERVAL_MS
  );

  // Also check shortly after startup.
  runInventoryCleanup();
}

function stopInventoryCleanupJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  runInventoryCleanup,
  startInventoryCleanupJob,
  stopInventoryCleanupJob
};
