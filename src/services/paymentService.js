
const { pool } = require("../config/database");
const { createMayaCheckout } = require("./mayaService");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  return error;
}

async function startMayaPayment(userId, orderId) {
  const client = await pool.connect();
  let order;

  // PHASE 1: Record the attempt before contacting Maya.
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

    order = orderResult.rows[0];

    if (order.status !== "PENDING") {
      throw fail("Order is not pending payment", 409);
    }

    const reservations = await client.query(
      `SELECT COUNT(*)::integer AS total,
              COUNT(*) FILTER (
                WHERE status = 'ACTIVE'
                  AND expires_at >
                    NOW() + INTERVAL '2 minutes'
              )::integer AS valid
       FROM inventory_reservations
       WHERE order_id = $1`,
      [orderId]
    );

    const counts = reservations.rows[0];

    if (
      counts.total === 0 ||
      counts.total !== counts.valid
    ) {
      throw fail(
        "Inventory reservation is missing or expiring.",
        409
      );
    }

    const existingPayment = await client.query(
      `SELECT id
       FROM payments
       WHERE order_id = $1
       LIMIT 1`,
      [orderId]
    );

    if (existingPayment.rowCount) {
      throw fail(
        "This order already has a payment record.",
        409
      );
    }

    const existingAttempt = await client.query(
      `SELECT id
       FROM maya_payment_attempts
       WHERE order_id = $1
       LIMIT 1`,
      [orderId]
    );

    if (existingAttempt.rowCount) {
      throw fail(
        "A Maya payment attempt already exists. " +
        "Reconciliation is required before retrying.",
        409
      );
    }

    await client.query(
      `INSERT INTO maya_payment_attempts (
         order_id, status
       )
       VALUES ($1, 'STARTED')`,
      [orderId]
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Payment transaction rollback failed:",
        rollbackError.message
      );
    }
    throw error;
  } finally {
    client.release();
  }

  // PHASE 2: Contact Maya without holding DB locks.
  let checkout;

  try {
    checkout = await createMayaCheckout(order);
  } catch (error) {
    // A provider error does not conclusively mean
    // Maya did not create a checkout session.
    try {
      await pool.query(
        `UPDATE maya_payment_attempts
         SET status = 'UNKNOWN',
             error_message = $2,
             updated_at = NOW()
         WHERE order_id = $1
           AND status = 'STARTED'`,
        [orderId, error.message]
      );
    } catch (saveError) {
      console.error(
        "Failed to record Maya uncertainty:",
        saveError.message
      );
    }

    throw error;
  }

  if (!checkout.checkoutId || !checkout.redirectUrl) {
    await pool.query(
      `UPDATE maya_payment_attempts
       SET status = 'UNKNOWN',
           error_message = 'Invalid Maya checkout response',
           updated_at = NOW()
       WHERE order_id = $1
         AND status = 'STARTED'`,
      [orderId]
    );

    throw fail("Invalid checkout response from Maya", 502);
  }

  // PHASE 3: Save the Maya session and payment.
  const saveClient = await pool.connect();

  try {
    await saveClient.query("BEGIN");

    const lockedOrder = await saveClient.query(
      `SELECT id, status
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (
      !lockedOrder.rowCount ||
      lockedOrder.rows[0].status !== "PENDING"
    ) {
      throw fail(
        "Order changed while creating payment session.",
        409
      );
    }

    // This is a local estimate, not proof of
    // Maya's actual session expiration.
    const sessionExpiry = new Date(
      Date.now() + 60 * 60 * 1000
    );

    const paymentResult = await saveClient.query(
      `INSERT INTO payments (
         order_id,
         payment_method,
         amount,
         status,
         provider_session_id,
         checkout_url,
         expires_at
       )
       VALUES (
         $1, 'MAYA', $2, 'PENDING', $3, $4, $5
       )
       RETURNING
         id, order_id, payment_method,
         amount, status, provider_session_id,
         checkout_url, expires_at`,
      [
        orderId,
        order.total_amount,
        checkout.checkoutId,
        checkout.redirectUrl,
        sessionExpiry
      ]
    );

    await saveClient.query(
      `UPDATE maya_payment_attempts
       SET status = 'SESSION_CREATED',
           provider_session_id = $2,
           updated_at = NOW()
       WHERE order_id = $1
         AND status = 'STARTED'`,
      [orderId, checkout.checkoutId]
    );

    await saveClient.query("COMMIT");

    return paymentResult.rows[0];
  } catch (error) {
    try {
      await saveClient.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Payment save rollback failed:",
        rollbackError.message
      );
    }

    // The STARTED record remains in the database.
    // Cleanup will not release its stock.
    throw error;
  } finally {
    saveClient.release();
  }
}

module.exports = { startMayaPayment };
