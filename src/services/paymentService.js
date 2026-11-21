
const { pool } = require("../config/database");
const { createMayaCheckout } = require("./mayaService");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function startMayaPayment(userId, orderId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id, total_amount, status
       FROM orders
       WHERE id = $1 AND customer_id = $2
       FOR UPDATE`,
      [orderId, userId]
    );

    if (!orderResult.rowCount) {
      throw fail("Order not found", 404);
    }

    const order = orderResult.rows[0];

    if (order.status !== "PENDING") {
      throw fail("Order is not pending payment", 409);
    }

    // Require active, unexpired inventory reservations.
    const reservations = await client.query(
      `SELECT COUNT(*)::integer AS total,
              COUNT(*) FILTER (
                WHERE status = 'ACTIVE'
                  AND expires_at > NOW() + INTERVAL '2 minutes'
              )::integer AS valid
       FROM inventory_reservations
       WHERE order_id = $1`,
      [orderId]
    );

    const counts = reservations.rows[0];

    if (counts.total === 0 || counts.total !== counts.valid) {
      throw fail(
        "Inventory reservation is missing or expiring. " +
        "Do not start payment for this order.",
        409
      );
    }

    const existing = await client.query(
      `SELECT id, checkout_url, provider_session_id,
              status, expires_at
       FROM payments
       WHERE order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    );

    if (existing.rowCount) {
      const payment = existing.rows[0];

      if (payment.status === "PENDING") {
        throw fail(
          "A Maya payment session already exists for this order. " +
          "Reconcile its status before creating another.",
          409
        );
      }

      throw fail(
        "This order has an existing payment record. " +
        "Resolve it before retrying.",
        409
      );
    }

    const checkout = await createMayaCheckout(order);

    if (!checkout.checkoutId || !checkout.redirectUrl) {
      throw fail("Invalid checkout response from Maya", 502);
    }

    // Maya checkout sessions are generally valid for 1 hour.
    const sessionExpiry = new Date(
      Date.now() + 60 * 60 * 1000
    );

    const result = await client.query(
      `INSERT INTO payments (
         order_id,
         payment_method,
         amount,
         status,
         provider_session_id,
         checkout_url,
         expires_at
       )
       VALUES ($1, 'MAYA', $2, 'PENDING', $3, $4, $5)
       RETURNING
         id, order_id, payment_method, amount,
         status, provider_session_id,
         checkout_url, expires_at`,
      [
        order.id,
        order.total_amount,
        checkout.checkoutId,
        checkout.redirectUrl,
        sessionExpiry
      ]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { startMayaPayment };
