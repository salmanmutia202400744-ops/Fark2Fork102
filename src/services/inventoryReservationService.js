
const { pool } = require("../config/database");

async function expireOneOrder(orderId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Match the lock order used by paymentService.
    const orderResult = await client.query(
      `SELECT id, status, created_at
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (!orderResult.rowCount) {
      await client.query("ROLLBACK");
      return { result: "NOT_FOUND" };
    }

    const order = orderResult.rows[0];

    if (order.status !== "PENDING") {
      await client.query("ROLLBACK");
      return { result: "NOT_PENDING" };
    }

    // Do not automatically touch legacy orders.
    const cutoff = await client.query(
      `SELECT safe_from
       FROM inventory_cleanup_settings
       WHERE id = 1`
    );

    if (
      !cutoff.rowCount ||
      new Date(order.created_at) <
        new Date(cutoff.rows[0].safe_from)
    ) {
      await client.query("ROLLBACK");
      return { result: "LEGACY_REVIEW_REQUIRED" };
    }

    // Any unresolved or historical payment attempt
    // blocks automatic stock release.
    const attempts = await client.query(
      `SELECT id
       FROM maya_payment_attempts
       WHERE order_id = $1
       LIMIT 1`,
      [orderId]
    );

    if (attempts.rowCount) {
      await client.query("ROLLBACK");
      return { result: "PAYMENT_REVIEW_REQUIRED" };
    }

    const payments = await client.query(
      `SELECT id
       FROM payments
       WHERE order_id = $1
       LIMIT 1`,
      [orderId]
    );

    if (payments.rowCount) {
      await client.query("ROLLBACK");
      return { result: "PAYMENT_REVIEW_REQUIRED" };
    }

    const reservations = await client.query(
      `SELECT id, product_id, quantity, expires_at
       FROM inventory_reservations
       WHERE order_id = $1
         AND status = 'ACTIVE'
       ORDER BY product_id, id
       FOR UPDATE`,
      [orderId]
    );

    if (!reservations.rowCount) {
      await client.query("ROLLBACK");
      return { result: "NO_ACTIVE_RESERVATIONS" };
    }

    // Only expire an order when ALL active
    // reservations have expired.
    const nowResult = await client.query(
      "SELECT NOW() AS current_time"
    );

    const now = new Date(nowResult.rows[0].current_time);

    const allExpired = reservations.rows.every(
      (r) => new Date(r.expires_at) <= now
    );

    if (!allExpired) {
      await client.query("ROLLBACK");
      return { result: "NOT_EXPIRED" };
    }

    // Lock products in a deterministic order.
    const productIds = [
      ...new Set(
        reservations.rows.map((r) => r.product_id)
      )
    ].sort();

    const products = await client.query(
      `SELECT id
       FROM products
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    if (products.rowCount !== productIds.length) {
      throw new Error(
        "Cannot restore stock: product record missing."
      );
    }

    // First change reservation state.
    // Then restore exactly the quantities changed.
    const released = await client.query(
      `UPDATE inventory_reservations
       SET status = 'EXPIRED',
           updated_at = NOW()
       WHERE order_id = $1
         AND status = 'ACTIVE'
         AND expires_at <= NOW()
       RETURNING product_id, quantity`,
      [orderId]
    );

    if (released.rowCount !== reservations.rowCount) {
      throw new Error(
        "Reservation count changed during cleanup."
      );
    }

    for (const reservation of released.rows) {
      await client.query(
        `UPDATE products
         SET stock_quantity =
               stock_quantity + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [
          reservation.quantity,
          reservation.product_id
        ]
      );
    }

    await client.query(
      `UPDATE orders
       SET status = 'CANCELLED',
           updated_at = NOW()
       WHERE id = $1
         AND status = 'PENDING'`,
      [orderId]
    );

    await client.query("COMMIT");

    return {
      result: "EXPIRED",
      orderId,
      reservationsRestored: released.rowCount
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Inventory rollback failed:",
        rollbackError.message
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupExpiredReservations(limit = 50) {
  const candidates = await pool.query(
    `SELECT DISTINCT ir.order_id
     FROM inventory_reservations ir
     JOIN orders o ON o.id = ir.order_id
     JOIN inventory_cleanup_settings s ON s.id = 1
     WHERE ir.status = 'ACTIVE'
       AND ir.expires_at <= NOW()
       AND o.status = 'PENDING'
       AND o.created_at >= s.safe_from
       AND NOT EXISTS (
         SELECT 1
         FROM payments p
         WHERE p.order_id = o.id
       )
       AND NOT EXISTS (
         SELECT 1
         FROM maya_payment_attempts a
         WHERE a.order_id = o.id
       )
     ORDER BY ir.order_id
     LIMIT $1`,
    [limit]
  );

  const results = [];

  for (const row of candidates.rows) {
    try {
      const result = await expireOneOrder(row.order_id);
      results.push(result);
    } catch (error) {
      console.error("Inventory cleanup error:", {
        orderId: row.order_id,
        message: error.message
      });
    }
  }

  return {
    checked: candidates.rowCount,
    restored: results.filter(
      (r) => r.result === "EXPIRED"
    ).length,
    results
  };
}

module.exports = {
  expireOneOrder,
  cleanupExpiredReservations
};
