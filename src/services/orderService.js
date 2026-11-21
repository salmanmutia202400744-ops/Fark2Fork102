
const { pool } = require("../config/database");
const repository = require("../repositories/orderRepository");
const ApiError = require("../utils/ApiError");

async function getOrders(customerId, page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    repository.findCustomerOrders(customerId, limit, offset),
    repository.countCustomerOrders(customerId)
  ]);

  return {
    orders: orders.map(({ total_count, ...order }) => order),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  };
}

async function getOrderDetails(orderId, customerId) {
  const order = await repository.findCustomerOrder(
    orderId,
    customerId
  );

  if (!order) {
    throw new ApiError(
      404,
      "ORDER_NOT_FOUND",
      "Order not found."
    );
  }

  const [items, reservations] = await Promise.all([
    repository.findOrderItems(orderId),
    repository.findOrderReservations(orderId)
  ]);

  return {
    ...order,
    items,
    reservations
  };
}

async function getOrderStatus(orderId, customerId) {
  const order = await repository.findCustomerOrder(
    orderId,
    customerId
  );

  if (!order) {
    throw new ApiError(
      404,
      "ORDER_NOT_FOUND",
      "Order not found."
    );
  }

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    created_at: order.created_at,
    updated_at: order.updated_at
  };
}

/*
 * Customer cancellation.
 *
 * Only cancels PENDING orders with no payment
 * records or Maya payment attempts.
 *
 * Uses the same lock order as inventory cleanup:
 * order -> reservations -> products.
 *
 * The payment initiation service must also lock
 * the order row before creating payment attempts.
 */
async function cancelOrder(orderId, customerId) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const orderResult = await client.query(
      `SELECT id, status, created_at
       FROM orders
       WHERE id = $1
         AND customer_id = $2
       FOR UPDATE`,
      [orderId, customerId]
    );

    if (!orderResult.rowCount) {
      throw new ApiError(
        404,
        "ORDER_NOT_FOUND",
        "Order not found."
      );
    }

    const order = orderResult.rows[0];

    if (order.status !== "PENDING") {
      throw new ApiError(
        409,
        "ORDER_NOT_CANCELLABLE",
        "Only pending orders can be cancelled."
      );
    }

    // Preserve the existing legacy-order safety cutoff.
    const cutoffResult = await client.query(
      `SELECT safe_from
       FROM inventory_cleanup_settings
       WHERE id = 1`
    );

    if (
      !cutoffResult.rowCount ||
      new Date(order.created_at) <
        new Date(cutoffResult.rows[0].safe_from)
    ) {
      throw new ApiError(
        409,
        "LEGACY_ORDER_REVIEW_REQUIRED",
        "This order requires manual review before cancellation."
      );
    }

    // Never release stock if Maya may have processed payment.
    const paymentResult = await client.query(
      `SELECT
         EXISTS (
           SELECT 1
           FROM payments
           WHERE order_id = $1
         ) AS has_payment,
         EXISTS (
           SELECT 1
           FROM maya_payment_attempts
           WHERE order_id = $1
         ) AS has_attempt`,
      [orderId]
    );

    const paymentState = paymentResult.rows[0];

    if (
      paymentState.has_payment ||
      paymentState.has_attempt
    ) {
      throw new ApiError(
        409,
        "PAYMENT_REVIEW_REQUIRED",
        "This order has payment activity and cannot be cancelled automatically."
      );
    }

    const reservationsResult = await client.query(
      `SELECT id, product_id, quantity
       FROM inventory_reservations
       WHERE order_id = $1
         AND status = 'ACTIVE'
       ORDER BY product_id, id
       FOR UPDATE`,
      [orderId]
    );

    const reservations = reservationsResult.rows;

    if (!reservations.length) {
      throw new ApiError(
        409,
        "NO_ACTIVE_RESERVATIONS",
        "No active inventory reservations were found."
      );
    }

    // Reject inconsistent or partially released reservations.
    const allReservations = await client.query(
      `SELECT COUNT(*)::integer AS total
       FROM inventory_reservations
       WHERE order_id = $1`,
      [orderId]
    );

    if (
      allReservations.rows[0].total !==
      reservations.length
    ) {
      throw new ApiError(
        409,
        "RESERVATION_REVIEW_REQUIRED",
        "Reservation state requires manual review."
      );
    }

    const productIds = [
      ...new Set(reservations.map(r => r.product_id))
    ].sort();

    const lockedProducts = await client.query(
      `SELECT id
       FROM products
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    if (lockedProducts.rowCount !== productIds.length) {
      throw new ApiError(
        409,
        "PRODUCT_REVIEW_REQUIRED",
        "A reserved product record is missing."
      );
    }

    /*
     * EXPIRED is already supported by the existing
     * inventory cleanup implementation.
     *
     * A dedicated RELEASED/CANCELLED reservation
     * state can be introduced in a future migration.
     */
    const released = await client.query(
      `UPDATE inventory_reservations
       SET status = 'EXPIRED',
           updated_at = NOW()
       WHERE order_id = $1
         AND status = 'ACTIVE'
       RETURNING product_id, quantity`,
      [orderId]
    );

    if (released.rowCount !== reservations.length) {
      throw new Error(
        "Reservation state changed during cancellation."
      );
    }

    for (const reservation of released.rows) {
      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [reservation.quantity, reservation.product_id]
      );
    }

    const updated = await client.query(
      `UPDATE orders
       SET status = 'CANCELLED',
           updated_at = NOW()
       WHERE id = $1
         AND customer_id = $2
         AND status = 'PENDING'
       RETURNING id, order_number, status, updated_at`,
      [orderId, customerId]
    );

    
if (updated.rowCount !== 1) {
  throw new Error(
    "Order status changed during cancellation."
  );
}

// Synchronize seller orders with the cancelled parent order.
await client.query(
  `UPDATE seller_orders
   SET status = 'CANCELLED',
       updated_at = NOW()
   WHERE order_id = $1
     AND status = 'PENDING'`,
  [orderId]
);

await client.query("COMMIT");

    inTransaction = false;

    return {
      ...updated.rows[0],
      reservations_released: released.rowCount
    };
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Order cancellation rollback failed:",
          rollbackError.message
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getOrders,
  getOrderDetails,
  getOrderStatus,
  cancelOrder
};
